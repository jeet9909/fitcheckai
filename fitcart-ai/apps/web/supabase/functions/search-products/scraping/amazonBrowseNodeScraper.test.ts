// Mocks globalThis.fetch — no real network call is ever made. Covers the
// deals-widget success path (using a trimmed real fixture shape captured
// live 2026-09-03 — see amazonBrowseNodeScraper.ts's header comment), the
// no-widget-present/blocked/failed outcome shapes, and the balanced-JSON
// extractor's handling of braces embedded inside string values (which a
// naive first-`{`-to-last-`}` slice or a non-string-aware brace counter
// would both get wrong).

import { assert, assertEquals } from '../_testUtils.ts';
import { scrapeAmazonBrowseNode } from './amazonBrowseNodeScraper.ts';

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

function widgetHtml(payload: unknown, widgetNumber = 30): string {
  return `<html><body><script>
    (function () {
      window.P.when('DiscountsWidgetsHorizonteAssets').execute(function (assets) {
        assets.mountWidget('merchandised-search-${widgetNumber}', ${JSON.stringify(payload)});
      });
    })();
  </script></body></html>`;
}

const REAL_SHAPED_PAYLOAD = {
  marketplaceId: 'A21TJRUUN4KGV',
  site: 'amazon.in',
  symphonyConfig: { filterInfo: { includedDepartments: ['1968024031'] } },
  productSearchResponse: {
    nextIndex: 30,
    startIndex: 0,
    products: [
      {
        asin: 'B00TEST1234',
        // Deliberately contains literal `{`/`}` characters inside the
        // string value — regression check for the balanced-JSON extractor
        // being string-aware rather than counting every brace in the text.
        title: 'Men\'s "Curly {Brace}" Casual Shirt',
        link: '/Some-Product-Slug/dp/B00TEST1234',
        image: { hiRes: { baseUrl: 'https://m.media-amazon.com/images/I/testhires', extension: 'jpg' } },
        price: { priceToPay: { price: '999.0' }, basisPrice: { price: '1499.0' } },
        brandLogo: { altText: 'TestBrand' },
      },
      {
        // No price at all — must be dropped, never fabricated as 0.
        asin: 'B00NOPRICE01',
        title: 'No Price Product',
        link: '/dp/B00NOPRICE01',
        image: { lowRes: { baseUrl: 'https://m.media-amazon.com/images/I/lowres', extension: 'jpg' } },
        price: {},
      },
    ],
  },
};

const NO_WIDGET_HTML = `<html><body><div id="dealsGridLinkAnchor" class="discounts-react-app"></div></body></html>`;

Deno.test('amazonBrowseNodeScraper: deals-widget success path, including a title with literal braces', async () => {
  await withMockedFetch(
    () => new Response(widgetHtml(REAL_SHAPED_PAYLOAD), { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'success');
      // Only the priced product survives; the no-price one is dropped.
      assertEquals(outcome.listings.length, 1);
      const listing = outcome.listings[0];
      assertEquals(listing.name, 'Men\'s "Curly {Brace}" Casual Shirt');
      assertEquals(listing.brand, 'TestBrand');
      assertEquals(listing.price, 999);
      assertEquals(listing.mrp, 1499);
      assertEquals(listing.imageUrl, 'https://m.media-amazon.com/images/I/testhires.jpg');
      assertEquals(listing.productUrl, 'https://www.amazon.in/Some-Product-Slug/dp/B00TEST1234');
      assertEquals(listing.store, 'Amazon');
    },
  );
});

Deno.test('amazonBrowseNodeScraper: a product missing a price is dropped, never given a fabricated price', async () => {
  await withMockedFetch(
    () =>
      new Response(
        widgetHtml({
          productSearchResponse: {
            products: [{ asin: 'B00X', title: 'No Price', link: '/dp/B00X', price: {} }],
          },
        }),
        { status: 200 },
      ),
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.length > 0);
    },
  );
});

Deno.test('amazonBrowseNodeScraper: a widget number other than 30 is still matched (the suffix varies)', async () => {
  await withMockedFetch(
    () => new Response(widgetHtml(REAL_SHAPED_PAYLOAD, 47), { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'success');
      assertEquals(outcome.listings.length, 1);
    },
  );
});

Deno.test('amazonBrowseNodeScraper: no deals widget on the page is reported as blocked, not an empty success', async () => {
  await withMockedFetch(
    () => new Response(NO_WIDGET_HTML, { status: 200 }),
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('deals widget'));
    },
  );
});

Deno.test('amazonBrowseNodeScraper: malformed JSON after the widget call is reported as blocked, not thrown', async () => {
  await withMockedFetch(
    () =>
      new Response(
        `<html><body><script>assets.mountWidget('merchandised-search-30', {"broken": ); </script></body></html>`,
        { status: 200 },
      ),
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
    },
  );
});

Deno.test('amazonBrowseNodeScraper: non-200 response is reported as blocked, not thrown', async () => {
  await withMockedFetch(
    () => new Response('Forbidden', { status: 403 }),
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('403'));
    },
  );
});

Deno.test('amazonBrowseNodeScraper: a response redirected to an unexpected host is reported as blocked, never parsed', async () => {
  await withMockedFetch(
    () => {
      const res = new Response(widgetHtml(REAL_SHAPED_PAYLOAD), { status: 200 });
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/gp/browse.html?node=1968024031' });
      return res;
    },
    async () => {
      const outcome = await scrapeAmazonBrowseNode('1968024031');
      assertEquals(outcome.status, 'blocked');
      assertEquals(outcome.listings.length, 0);
      assert(typeof outcome.reason === 'string' && outcome.reason.includes('unexpected host'));
    },
  );
});

Deno.test('amazonBrowseNodeScraper: a thrown fetch error is reported as failed with a capped reason', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.reject(new Error('network is down: ' + 'x'.repeat(500)))) as typeof fetch;
    const outcome = await scrapeAmazonBrowseNode('1968024031');
    assertEquals(outcome.status, 'failed');
    assertEquals(outcome.listings.length, 0);
    assert(typeof outcome.reason === 'string');
    assert((outcome.reason as string).length <= 200, `reason not capped: ${outcome.reason?.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
