// Mocks globalThis.fetch — no real network call is ever made. Covers the
// JSON-LD success path, the HTML-tile fallback success path, and the
// blocked/failed outcome shapes. See amazonSearchScraper.ts's header
// comment for what was actually observed against the real live site
// (which is: no JSON-LD, but the HTML-tile fallback worked) — the JSON-LD
// success case here is exercised defensively in case a future response
// includes it, not because it's what's live today.

import { assert, assertEquals } from '../_testUtils.ts';
import { scrapeAmazonSearch } from './amazonSearchScraper.ts';

function withMockedFetch(handler: (url: string) => Response, fn: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(handler(url));
  }) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

const JSON_LD_HTML = `<html><head>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: [
    {
      '@type': 'Product',
      name: 'JSON-LD Cotton Shirt',
      url: 'https://www.amazon.in/dp/JSONLD123',
      image: 'https://m.media-amazon.com/images/I/jsonld123._AC_UL320_.jpg',
      brand: { name: 'JsonBrand' },
      offers: { price: '999', priceCurrency: 'INR' },
    },
  ],
})}
</script>
</head><body></body></html>`;

const TILE_HTML = `<html><body>
<div role="listitem" data-asin="B0TESTASIN1" data-component-type="s-search-result" class="s-result-item">
  <h2 class="brand-h2"><span>BrandOnly</span></h2>
  <a href="/dp/B0TESTASIN1"><h2 class="title-h2"><span>Men&#x27;s Solid Cotton Casual Shirt Full Sleeve</span></h2></a>
  <img class="s-image" src="https://m.media-amazon.com/images/I/tile123._AC_UL320_.jpg" />
  <span class="a-price" data-a-size="xl" data-a-color="base"><span class="a-offscreen">₹799</span></span>
  <span class="a-price a-text-price" data-a-size="b" data-a-strike="true" data-a-color="secondary"><span class="a-offscreen">₹1,299</span></span>
</div>
</body></html>`;

const EMPTY_HTML = `<html><body><div id="captcha-container">Sorry, something went wrong.</div></body></html>`;

// Regression fixture for the parseIndianPrice fractional-price bug: a real
// Amazon tile with a price that has paise (e.g. "₹599.50"). Before the fix,
// this flowed straight through as a non-integer `price`/`mrp`, which would
// make `upsertListings`' single `.upsert()` call for the whole store fail
// against the `integer not null` products.price/mrp columns — silently
// turning an entire successful scrape into a reported DB error for every
// listing from that store.
const FRACTIONAL_PRICE_TILE_HTML = `<html><body>
<div role="listitem" data-asin="B0FRACTIONAL1" data-component-type="s-search-result" class="s-result-item">
  <a href="/dp/B0FRACTIONAL1"><h2 class="title-h2"><span>Women's Printed Cotton Kurta Regular Fit</span></h2></a>
  <img class="s-image" src="https://m.media-amazon.com/images/fractional.jpg" />
  <span class="a-price" data-a-size="xl" data-a-color="base"><span class="a-offscreen">₹599.50</span></span>
  <span class="a-price a-text-price" data-a-size="b" data-a-strike="true" data-a-color="secondary"><span class="a-offscreen">₹1,299.99</span></span>
</div>
</body></html>`;

Deno.test('amazonSearchScraper: JSON-LD success path', async () => {
  await withMockedFetch(
    () => new Response(JSON_LD_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonSearch("men's shirt");
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      assertEquals(outcome.listings[0].name, 'JSON-LD Cotton Shirt');
      assertEquals(outcome.listings[0].price, 999);
      assertEquals(outcome.listings[0].productUrl, 'https://www.amazon.in/dp/JSONLD123');
      assertEquals(outcome.listings[0].store, 'Amazon');
      // Upsized from the raw ._AC_UL320_ thumbnail the fixture used —
      // regression check for the 2026-09-04 low-resolution-image fix.
      assertEquals(outcome.listings[0].imageUrl, 'https://m.media-amazon.com/images/I/jsonld123._AC_SL1500_.jpg');
    },
  );
});

Deno.test('amazonSearchScraper: HTML-tile fallback success path when no JSON-LD is present', async () => {
  await withMockedFetch(
    () => new Response(TILE_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonSearch("men's shirt");
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      const listing = outcome.listings[0];
      assertEquals(listing.name, "Men's Solid Cotton Casual Shirt Full Sleeve");
      assertEquals(listing.price, 799);
      assertEquals(listing.mrp, 1299);
      // Upsized from the raw ._AC_UL320_ thumbnail the fixture used —
      // regression check for the 2026-09-04 low-resolution-image fix.
      assertEquals(listing.imageUrl, 'https://m.media-amazon.com/images/I/tile123._AC_SL1500_.jpg');
      assertEquals(listing.productUrl, 'https://www.amazon.in/dp/B0TESTASIN1');
      assertEquals(listing.store, 'Amazon');
    },
  );
});

Deno.test('amazonSearchScraper: a tile with a fractional price (e.g. "₹599.50") yields an integer price/mrp, never a fraction that would break the store\'s DB upsert', async () => {
  await withMockedFetch(
    () => new Response(FRACTIONAL_PRICE_TILE_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonSearch("women's kurta");
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      const listing = outcome.listings[0];
      // Assert the actual returned values (not just "truthy"/"parsed") —
      // 600 is ₹599.50 rounded to the nearest rupee, matching the exact
      // Math.round() convention amazonPaapi.ts/flipkartAffiliate.ts use.
      assertEquals(listing.price, 600);
      assertEquals(listing.mrp, 1300);
      assert(Number.isInteger(listing.price), `expected an integer price, got ${listing.price}`);
      assert(Number.isInteger(listing.mrp), `expected an integer mrp, got ${listing.mrp}`);
    },
  );
});

Deno.test('amazonSearchScraper: non-200 response is reported as blocked, not thrown', async () => {
  await withMockedFetch(
    () => new Response('Forbidden', { status: 403 }),
    async () => {
      const outcome = await scrapeAmazonSearch('shirt');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('403'));
    },
  );
});

Deno.test('amazonSearchScraper: 200 with no parseable items is reported as blocked', async () => {
  await withMockedFetch(
    () => new Response(EMPTY_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonSearch('shirt');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.length > 0);
    },
  );
});

Deno.test('amazonSearchScraper: a response redirected to an unexpected host is reported as blocked, never parsed', async () => {
  await withMockedFetch(
    () => {
      const res = new Response(TILE_HTML, { status: 200 });
      // Simulates `fetch` having followed a redirect to a host other than
      // amazon.in (e.g. a hijacked/compromised redirect target) — the real
      // Fetch API populates Response.url with the final URL after redirects;
      // a manually-constructed Response always has an empty url, so it's
      // overridden here to exercise that path.
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/s?k=shirt' });
      return res;
    },
    async () => {
      const outcome = await scrapeAmazonSearch('shirt');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('unexpected host'));
    },
  );
});

Deno.test('amazonSearchScraper: a thrown fetch error is reported as failed with a capped reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.reject(new Error('network is down: ' + 'x'.repeat(500)))) as typeof fetch;
    const outcome = await scrapeAmazonSearch('shirt');
    assertEquals(outcome.status, 'failed');
    assertEquals(outcome.listings.length, 0);
    assert(typeof outcome.reason === 'string');
    assert((outcome.reason as string).length <= 200, `reason not capped: ${outcome.reason?.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
