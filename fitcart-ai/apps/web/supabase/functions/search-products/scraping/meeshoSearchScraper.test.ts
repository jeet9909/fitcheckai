// Mocks globalThis.fetch — no real network call is ever made. Covers the
// JSON-LD success path (defensive — not what's live today, see
// meeshoSearchScraper.ts's header comment), non-200 -> blocked, 200-but-
// unparseable -> blocked, and thrown/timeout -> failed.

import { assert, assertEquals } from '../_testUtils.ts';
import { scrapeMeeshoSearch } from './meeshoSearchScraper.ts';

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
      name: 'JSON-LD Cotton Kurta',
      url: 'https://www.meesho.com/product/jsonld-kurta/p/abc123',
      image: 'https://images.meesho.com/images/jsonld.jpg',
      brand: { name: 'JsonBrand' },
      offers: { price: '399', priceCurrency: 'INR' },
    },
  ],
})}
</script>
</head><body></body></html>`;

// Mirrors what was actually observed live 2026-09-02/03: a real 200 page
// whose only JSON-LD block is a site-wide Organization entry, no product
// data at all.
const REAL_OBSERVED_HTML = `<html><head>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  url: 'https://www.meesho.com',
  name: 'Meesho',
})}
</script>
</head><body></body></html>`;

Deno.test('meeshoSearchScraper: JSON-LD success path (defensive, not the live shape today)', async () => {
  await withMockedFetch(
    () => new Response(JSON_LD_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeMeeshoSearch('kurta');
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      assertEquals(outcome.listings[0].name, 'JSON-LD Cotton Kurta');
      assertEquals(outcome.listings[0].price, 399);
      assertEquals(outcome.listings[0].productUrl, 'https://www.meesho.com/product/jsonld-kurta/p/abc123');
      assertEquals(outcome.listings[0].store, 'Meesho');
    },
  );
});

Deno.test('meeshoSearchScraper: the real observed live shape (Organization-only JSON-LD) is reported as blocked', async () => {
  await withMockedFetch(
    () => new Response(REAL_OBSERVED_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeMeeshoSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.length > 0);
    },
  );
});

Deno.test('meeshoSearchScraper: non-200 response is reported as blocked, not thrown', async () => {
  await withMockedFetch(
    () => new Response('Forbidden', { status: 403 }),
    async () => {
      const outcome = await scrapeMeeshoSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('403'));
    },
  );
});

Deno.test('meeshoSearchScraper: a response redirected to an unexpected host is reported as blocked, never parsed', async () => {
  await withMockedFetch(
    () => {
      const res = new Response(JSON_LD_HTML, { status: 200 });
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/search?q=kurta' });
      return res;
    },
    async () => {
      const outcome = await scrapeMeeshoSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('unexpected host'));
    },
  );
});

Deno.test('meeshoSearchScraper: a thrown fetch error is reported as failed with a capped reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.reject(new Error('network is down: ' + 'x'.repeat(500)))) as typeof fetch;
    const outcome = await scrapeMeeshoSearch('kurta');
    assertEquals(outcome.status, 'failed');
    assertEquals(outcome.listings.length, 0);
    assert(typeof outcome.reason === 'string');
    assert((outcome.reason as string).length <= 200, `reason not capped: ${outcome.reason?.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
