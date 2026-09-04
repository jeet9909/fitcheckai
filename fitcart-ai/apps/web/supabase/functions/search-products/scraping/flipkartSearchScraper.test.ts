// Mocks globalThis.fetch — no real network call is ever made. Covers the
// JSON-LD success path, the embedded __INITIAL_STATE__ fallback success
// path, and the blocked/failed outcome shapes. See
// flipkartSearchScraper.ts's header comment for what was actually observed
// against the real live site (a real ItemList JSON-LD block with no price,
// plus a real __INITIAL_STATE__ blob with full pricing data) — the
// JSON-LD-with-price success case here is exercised defensively in case a
// future response includes a real price in that block, which is not what's
// live today.

import { assert, assertEquals } from '../_testUtils.ts';
import { scrapeFlipkartSearch } from './flipkartSearchScraper.ts';

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

const JSON_LD_WITH_PRICE_HTML = `<html><head>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: [
    {
      name: 'JSON-LD Denim Shirt',
      url: 'https://www.flipkart.com/jsonld-denim-shirt/p/itmjsonld1',
      image: 'https://rukminim.flixcart.com/image/jsonld.jpg',
      offers: { price: '899', priceCurrency: 'INR' },
    },
  ],
})}
</script>
</head><body></body></html>`;

// Mirrors what was actually observed live: an ItemList JSON-LD block with
// only name/url/position (no price) plus a real __INITIAL_STATE__ blob
// carrying full PRODUCT_SUMMARY widget data.
function buildRealisticHtml(): string {
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      { '@type': 'ListItem', name: 'Metronaut Casual Shirt', position: 1, url: 'https://www.flipkart.com/metronaut-shirt/p/itmabc123' },
    ],
  });

  const initialState = {
    pageDataV4: {
      page: {
        data: {
          '10002': [
            {
              slotType: 'WIDGET',
              widget: {
                type: 'PRODUCT_SUMMARY',
                data: {
                  products: [
                    {
                      productInfo: {
                        value: {
                          baseUrl: '/metronaut-shirt/p/itmabc123?pid=SHT123',
                          titles: { title: 'Metronaut Casual Shirt', superTitle: 'METRONAUT' },
                          pricing: {
                            prices: [
                              { value: 999, strikeOff: true, name: 'Selling Price' },
                              { value: 288, strikeOff: false, name: 'Special Price' },
                            ],
                          },
                          media: {
                            images: [{ url: 'http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/shirt/test.jpeg?q={@quality}' }],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  };

  return `<html><head>
<script type="application/ld+json">${jsonLd}</script>
<script id="is_script">window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};</script>
</head><body></body></html>`;
}

// Regression fixture for the fractional-price DB-upsert-batch bug
// (originally fixed in parseIndianPrice for the JSON-LD path, but the
// __INITIAL_STATE__ path in listingFromProductValue pulls `pricing.prices[].value`
// straight out of the parsed JSON and never routed through parseIndianPrice at
// all). No JSON-LD price is present here (matching the real observed live
// shape), so this exercises the __INITIAL_STATE__ fallback that's the actual
// production data source for Flipkart.
function buildFractionalPriceHtml(): string {
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      { '@type': 'ListItem', name: 'Fractional Price Kurta', position: 1, url: 'https://www.flipkart.com/fractional-kurta/p/itmfrac1' },
    ],
  });

  const initialState = {
    pageDataV4: {
      page: {
        data: {
          '10002': [
            {
              slotType: 'WIDGET',
              widget: {
                type: 'PRODUCT_SUMMARY',
                data: {
                  products: [
                    {
                      productInfo: {
                        value: {
                          baseUrl: '/fractional-kurta/p/itmfrac1?pid=KUR123',
                          titles: { title: 'Fractional Price Kurta', superTitle: 'FabIndia' },
                          pricing: {
                            prices: [
                              { value: 1299.99, strikeOff: true, name: 'Selling Price' },
                              { value: 599.5, strikeOff: false, name: 'Special Price' },
                            ],
                          },
                          media: {
                            images: [{ url: 'http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/kurta/frac.jpeg?q={@quality}' }],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  };

  return `<html><head>
<script type="application/ld+json">${jsonLd}</script>
<script id="is_script">window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};</script>
</head><body></body></html>`;
}

const EMPTY_HTML = `<html><body><div>Access Denied</div></body></html>`;

Deno.test('flipkartSearchScraper: JSON-LD success path when a real price is present', async () => {
  await withMockedFetch(
    () => new Response(JSON_LD_WITH_PRICE_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeFlipkartSearch("men's shirt");
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      assertEquals(outcome.listings[0].name, 'JSON-LD Denim Shirt');
      assertEquals(outcome.listings[0].price, 899);
      assertEquals(outcome.listings[0].productUrl, 'https://www.flipkart.com/jsonld-denim-shirt/p/itmjsonld1');
      assertEquals(outcome.listings[0].store, 'Flipkart');
    },
  );
});

Deno.test('flipkartSearchScraper: falls back to __INITIAL_STATE__ when JSON-LD has no price (the real observed live shape)', async () => {
  await withMockedFetch(
    () => new Response(buildRealisticHtml(), { status: 200 }),
    async () => {
      const outcome = await scrapeFlipkartSearch("men's shirt");
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      const listing = outcome.listings[0];
      assertEquals(listing.name, 'Metronaut Casual Shirt');
      assertEquals(listing.brand, 'METRONAUT');
      assertEquals(listing.price, 288);
      assertEquals(listing.mrp, 999);
      assertEquals(listing.productUrl, 'https://www.flipkart.com/metronaut-shirt/p/itmabc123?pid=SHT123');
      // 832x832/q80, not the old 200x200/q70 thumbnail — bumped 2026-09-04,
      // the 200x200 size was visibly blurry once rendered at product-detail
      // size (see htmlUtils.ts's upsizeAmazonImageUrl comment for the
      // equivalent Amazon-side fix).
      assert(listing.imageUrl?.includes('832') ?? false, `expected the 832x832 placeholder substitution in ${listing.imageUrl}`);
      assertEquals(listing.store, 'Flipkart');
    },
  );
});

Deno.test('flipkartSearchScraper: __INITIAL_STATE__ path with a fractional price (e.g. 599.5) yields an integer price/mrp, never a fraction that would break the store\'s DB upsert', async () => {
  await withMockedFetch(
    () => new Response(buildFractionalPriceHtml(), { status: 200 }),
    async () => {
      const outcome = await scrapeFlipkartSearch("women's kurta");
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      const listing = outcome.listings[0];
      // Assert the actual returned values (not just "truthy"/"parsed") —
      // 600 is 599.5 rounded to the nearest rupee, 1300 is 1299.99 rounded,
      // matching the exact Math.round() convention used by parseIndianPrice,
      // amazonPaapi.ts, and flipkartAffiliate.ts.
      assertEquals(listing.price, 600);
      assertEquals(listing.mrp, 1300);
      assert(Number.isInteger(listing.price), `expected an integer price, got ${listing.price}`);
      assert(Number.isInteger(listing.mrp), `expected an integer mrp, got ${listing.mrp}`);
    },
  );
});

Deno.test('flipkartSearchScraper: non-200 response is reported as blocked, not thrown', async () => {
  await withMockedFetch(
    () => new Response('Forbidden', { status: 403 }),
    async () => {
      const outcome = await scrapeFlipkartSearch('shirt');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('403'));
    },
  );
});

Deno.test('flipkartSearchScraper: 200 with no parseable items is reported as blocked', async () => {
  await withMockedFetch(
    () => new Response(EMPTY_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeFlipkartSearch('shirt');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.length > 0);
    },
  );
});

Deno.test('flipkartSearchScraper: a response redirected to an unexpected host is reported as blocked, never parsed', async () => {
  await withMockedFetch(
    () => {
      const res = new Response(JSON_LD_WITH_PRICE_HTML, { status: 200 });
      // Simulates `fetch` having followed a redirect to a host other than
      // flipkart.com (e.g. a hijacked/compromised redirect target) — the
      // real Fetch API populates Response.url with the final URL after
      // redirects; a manually-constructed Response always has an empty
      // url, so it's overridden here to exercise that path.
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/search?q=shirt' });
      return res;
    },
    async () => {
      const outcome = await scrapeFlipkartSearch('shirt');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('unexpected host'));
    },
  );
});

Deno.test('flipkartSearchScraper: a thrown fetch error is reported as failed with a capped reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.reject(new Error('network is down: ' + 'x'.repeat(500)))) as typeof fetch;
    const outcome = await scrapeFlipkartSearch('shirt');
    assertEquals(outcome.status, 'failed');
    assertEquals(outcome.listings.length, 0);
    assert(typeof outcome.reason === 'string');
    assert((outcome.reason as string).length <= 200, `reason not capped: ${outcome.reason?.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
