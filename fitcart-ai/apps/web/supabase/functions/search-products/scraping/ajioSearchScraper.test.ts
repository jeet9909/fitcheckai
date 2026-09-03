// Mocks globalThis.fetch — no real network call is ever made. Covers the
// JSON-LD-with-price success path (defensive — not what's live today, see
// ajioSearchScraper.ts's header comment), the real observed live shape
// (JSON-LD ItemList with no price -> blocked), non-200 -> blocked, and
// thrown/timeout -> failed.

import { assert, assertEquals } from '../_testUtils.ts';
import { scrapeAjioSearch } from './ajioSearchScraper.ts';

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
      '@type': 'Product',
      name: 'JSON-LD Straight Kurta',
      url: 'https://www.ajio.com/some-kurta/p/443118917_green',
      image: 'https://assets.ajio.com/images/jsonld.jpg',
      brand: { name: 'SomeBrand' },
      offers: { price: '1299', priceCurrency: 'INR' },
    },
  ],
})}
</script>
</head><body></body></html>`;

// Mirrors what was actually observed live 2026-09-02/03: a real ItemList
// JSON-LD block whose entries carry name/url/image only, no price.
const REAL_OBSERVED_HTML = `<html><head>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'http://schema.org',
  '@type': 'ItemList',
  url: 'http://www.ajio.com/search/?text=kurta',
  numberOfItems: '66770',
  itemListElement: [
    { '@type': 'ListItem', name: "AVAASA MIX N' MATCH Women Floral Print Straight Kurta", image: 'https://assets.ajio.com/medias/x.jpg', url: 'https://www.ajio.com/avaasa-mix-n-match-women-floral-print-straight-kurta/p/443118917_green', position: 1 },
  ],
})}
</script>
</head><body></body></html>`;

Deno.test('ajioSearchScraper: JSON-LD-with-price success path (defensive, not the live shape today)', async () => {
  await withMockedFetch(
    () => new Response(JSON_LD_WITH_PRICE_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAjioSearch('kurta');
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
      assertEquals(outcome.listings[0].name, 'JSON-LD Straight Kurta');
      assertEquals(outcome.listings[0].price, 1299);
      assertEquals(outcome.listings[0].productUrl, 'https://www.ajio.com/some-kurta/p/443118917_green');
      assertEquals(outcome.listings[0].store, 'AJIO');
    },
  );
});

Deno.test('ajioSearchScraper: the real observed live shape (ItemList with no price) is reported as blocked', async () => {
  await withMockedFetch(
    () => new Response(REAL_OBSERVED_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAjioSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('carried a real price'));
    },
  );
});

Deno.test('ajioSearchScraper: non-200 response is reported as blocked, not thrown', async () => {
  await withMockedFetch(
    () => new Response('Forbidden', { status: 403 }),
    async () => {
      const outcome = await scrapeAjioSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('403'));
    },
  );
});

Deno.test('ajioSearchScraper: a response redirected to an unexpected host is reported as blocked, never parsed', async () => {
  await withMockedFetch(
    () => {
      const res = new Response(JSON_LD_WITH_PRICE_HTML, { status: 200 });
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/search/?text=kurta' });
      return res;
    },
    async () => {
      const outcome = await scrapeAjioSearch('kurta');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('unexpected host'));
    },
  );
});

Deno.test('ajioSearchScraper: a thrown fetch error is reported as failed with a capped reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.reject(new Error('network is down: ' + 'x'.repeat(500)))) as typeof fetch;
    const outcome = await scrapeAjioSearch('kurta');
    assertEquals(outcome.status, 'failed');
    assertEquals(outcome.listings.length, 0);
    assert(typeof outcome.reason === 'string');
    assert((outcome.reason as string).length <= 200, `reason not capped: ${outcome.reason?.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
