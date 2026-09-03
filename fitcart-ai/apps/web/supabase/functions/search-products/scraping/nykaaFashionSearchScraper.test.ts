// Mocks globalThis.fetch — no real network call is ever made. Covers the
// JSON-LD success path (defensive — untested against a real successful
// response, see nykaaFashionSearchScraper.ts's header comment), the real
// observed live shape (502 -> blocked), 200-but-unparseable -> blocked, and
// thrown/timeout -> failed.

import { assert, assertEquals } from '../_testUtils.ts';
import { scrapeNykaaFashionSearch } from './nykaaFashionSearchScraper.ts';

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
      name: 'JSON-LD Printed Kurta',
      url: 'https://www.nykaafashion.com/product/jsonld-kurta/p/abc123',
      image: 'https://images-static.nykaa.com/jsonld.jpg',
      brand: { name: 'JsonBrand' },
      offers: { price: '1099', priceCurrency: 'INR' },
    },
  ],
})}
</script>
</head><body></body></html>`;

const EMPTY_HTML = `<html><body><div id="empty">nothing here</div></body></html>`;

// Mirrors what was actually observed live 2026-09-02/03, twice: a real 502
// Bad Gateway from nginx, no HTML page content at all.
const REAL_OBSERVED_502_BODY = `<html>
<head><title>502 Bad Gateway</title></head>
<body>
<center><h1>502 Bad Gateway</h1></center>
<hr><center>nginx</center>
</body>
</html>`;

Deno.test('nykaaFashionSearchScraper: JSON-LD success path (defensive, untested against a real successful response)', async () => {
  await withMockedFetch(
    () => new Response(JSON_LD_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeNykaaFashionSearch('kurta');
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      assertEquals(outcome.listings[0].name, 'JSON-LD Printed Kurta');
      assertEquals(outcome.listings[0].price, 1099);
      assertEquals(outcome.listings[0].productUrl, 'https://www.nykaafashion.com/product/jsonld-kurta/p/abc123');
      assertEquals(outcome.listings[0].store, 'Nykaa Fashion');
    },
  );
});

Deno.test('nykaaFashionSearchScraper: the real observed live shape (502 Bad Gateway) is reported as blocked', async () => {
  await withMockedFetch(
    () => new Response(REAL_OBSERVED_502_BODY, { status: 502 }),
    async () => {
      const outcome = await scrapeNykaaFashionSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('502'));
    },
  );
});

Deno.test('nykaaFashionSearchScraper: 200 with no parseable items is reported as blocked', async () => {
  await withMockedFetch(
    () => new Response(EMPTY_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeNykaaFashionSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.length > 0);
    },
  );
});

Deno.test('nykaaFashionSearchScraper: a response redirected to an unexpected host is reported as blocked, never parsed', async () => {
  await withMockedFetch(
    () => {
      const res = new Response(JSON_LD_HTML, { status: 200 });
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/search?q=kurta' });
      return res;
    },
    async () => {
      const outcome = await scrapeNykaaFashionSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('unexpected host'));
    },
  );
});

Deno.test('nykaaFashionSearchScraper: a thrown fetch error is reported as failed with a capped reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.reject(new Error('network is down: ' + 'x'.repeat(500)))) as typeof fetch;
    const outcome = await scrapeNykaaFashionSearch('kurta');
    assertEquals(outcome.status, 'failed');
    assertEquals(outcome.listings.length, 0);
    assert(typeof outcome.reason === 'string');
    assert((outcome.reason as string).length <= 200, `reason not capped: ${outcome.reason?.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
