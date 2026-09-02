// Exercises runProvider/runMarketplaceSearch end-to-end against mocked
// fetch (no real Amazon/Flipkart calls). Focus: provider isolation (one
// provider failing/being unconfigured must never blank the other's
// results) and the MOCK_MARKETPLACES short-circuit.

import { assert, assertEquals } from './_testUtils.ts';
import { __resetTokenCacheForTests } from './amazonPaapi.ts';
import { runMarketplaceSearch } from './orchestrator.ts';

const ALL_ENV_KEYS = [
  'AMAZON_CREATORS_CLIENT_ID',
  'AMAZON_CREATORS_CLIENT_SECRET',
  'AMAZON_CREATORS_PARTNER_TAG',
  'FLIPKART_AFFILIATE_ID',
  'FLIPKART_AFFILIATE_TOKEN',
  'MOCK_MARKETPLACES',
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ALL_ENV_KEYS.map((k) => [k, Deno.env.get(k)]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const k of ALL_ENV_KEYS) {
    const v = snapshot[k];
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

const FLIPKART_SUCCESS_BODY = {
  products: [
    {
      productBaseInfoV1: {
        title: 'Working Flipkart Shirt',
        brand: 'GoodBrand',
        imageUrls: { '200x200': 'https://rukminim.flixcart.com/image/test.jpg' },
        maximumRetailPrice: { amount: 1999 },
        flipkartSellingPrice: { amount: 999 },
        productUrl: 'https://www.flipkart.com/working-shirt/p/itm999',
      },
    },
  ],
};

Deno.test('orchestrator: one provider erroring never blanks out the other provider\'s results', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    Deno.env.delete('MOCK_MARKETPLACES');
    // Amazon: configured but its token endpoint will fail -> provider error.
    Deno.env.set('AMAZON_CREATORS_CLIENT_ID', 'client-id');
    Deno.env.set('AMAZON_CREATORS_CLIENT_SECRET', 'client-secret');
    Deno.env.set('AMAZON_CREATORS_PARTNER_TAG', 'tag-21');
    // Flipkart: configured and will succeed.
    Deno.env.set('FLIPKART_AFFILIATE_ID', 'fk-id');
    Deno.env.set('FLIPKART_AFFILIATE_TOKEN', 'fk-token');

    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/o2/token')) {
        return Promise.resolve(new Response('server error', { status: 500 }));
      }
      if (url.includes('affiliate-api.flipkart.net')) {
        return Promise.resolve(new Response(JSON.stringify(FLIPKART_SUCCESS_BODY), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected fetch call to ${url}`));
    }) as typeof fetch;

    const { results, providers } = await runMarketplaceSearch('shirt', 'all');

    assertEquals(providers.amazon.status, 'error');
    assertEquals(providers.amazon.listings.length, 0);
    assert(typeof providers.amazon.message === 'string' && providers.amazon.message.length > 0);

    assertEquals(providers.flipkart.status, 'success');
    assertEquals(providers.flipkart.listings.length, 1);
    assertEquals(providers.flipkart.listings[0].source, 'live');

    // Merged results must still contain Flipkart's listing despite Amazon's failure.
    assertEquals(results.length, 1);
    assertEquals(results[0].name, 'Working Flipkart Shirt');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

// NOTE: unconfigured providers no longer short-circuit straight to
// 'not_configured' — runProvider now attempts the scraping fallback first
// (see the "scraping fallback" tests further below for the
// success/blocked/failed outcomes of that attempt). 'not_configured' is
// still a valid ProviderStatus value (kept for type/message continuity and
// in case a future provider has no scraper at all), but for amazon/flipkart
// specifically it's superseded by 'scrape_*' in practice. This test now
// covers what's actually still true post-change: an unconfigured provider
// whose scrape attempt itself throws must resolve to 'scrape_failed'
// without ever throwing out of runMarketplaceSearch/Promise.all.
Deno.test('orchestrator: unconfigured providers never throw out of runMarketplaceSearch, even if the scrape fallback errors', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));
    globalThis.fetch = (() => Promise.reject(new Error('simulated network failure'))) as typeof fetch;

    const { results, providers } = await runMarketplaceSearch('shirt', 'all');

    assertEquals(providers.amazon.status, 'scrape_failed');
    assertEquals(providers.flipkart.status, 'scrape_failed');
    assertEquals(results.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('orchestrator: a single-store marketplace request only runs that provider', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));
    Deno.env.set('FLIPKART_AFFILIATE_ID', 'fk-id');
    Deno.env.set('FLIPKART_AFFILIATE_TOKEN', 'fk-token');
    globalThis.fetch = (() =>
      Promise.resolve(new Response(JSON.stringify(FLIPKART_SUCCESS_BODY), { status: 200 }))) as typeof fetch;

    const { providers } = await runMarketplaceSearch('shirt', 'flipkart');

    assertEquals(Object.keys(providers), ['flipkart']);
    assertEquals(providers.flipkart.status, 'success');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('orchestrator: MOCK_MARKETPLACES short-circuits both providers without touching fetch/configured()', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    // Deliberately leave real credentials unset — mock mode must not care.
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));
    Deno.env.set('MOCK_MARKETPLACES', 'true');

    globalThis.fetch = (() =>
      Promise.reject(new Error('fetch must never be called while MOCK_MARKETPLACES is active'))) as typeof fetch;

    const { results, providers } = await runMarketplaceSearch('jeans', 'all');

    assertEquals(providers.amazon.status, 'mock');
    assertEquals(providers.flipkart.status, 'mock');
    assert(providers.amazon.listings.length > 0);
    assert(providers.flipkart.listings.length > 0);
    for (const listing of results) {
      assertEquals(listing.source, 'mock');
      assert(listing.productUrl.startsWith('https://example.com/'));
    }
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

// ---------------------------------------------------------------------------
// Scraping fallback (unconfigured provider + real-API credentials absent):
// runProvider now attempts scrapeAmazonSearch()/scrapeFlipkartSearch()
// instead of immediately returning 'not_configured'. These tests mock
// globalThis.fetch to respond to the scrapers' real target URLs
// (amazon.in / flipkart.com) rather than mocking the scraper functions
// themselves — there's no dependency-injection seam for that, and this
// exercises the exact same fetch-mocking convention already used above.
// ---------------------------------------------------------------------------

const AMAZON_TILE_HTML = `<html><body>
<div role="listitem" data-asin="B0ORCHTEST1" data-component-type="s-search-result">
  <h2><span>Brand</span></h2>
  <a href="/dp/B0ORCHTEST1"><h2><span>Orchestrator Test Cotton Shirt</span></h2></a>
  <img class="s-image" src="https://m.media-amazon.com/images/orch.jpg" />
  <span class="a-price" data-a-color="base"><span class="a-offscreen">₹599</span></span>
</div>
</body></html>`;

const FLIPKART_JSONLD_WITH_PRICE_HTML = `<html><head>
<script type="application/ld+json">
${JSON.stringify({
  '@type': 'ItemList',
  itemListElement: [
    {
      name: 'Orchestrator Test Denim Shirt',
      url: 'https://www.flipkart.com/orch-test-shirt/p/itmorch1',
      offers: { price: '699' },
    },
  ],
})}
</script>
</head><body></body></html>`;

Deno.test('orchestrator: unconfigured provider whose scrape succeeds returns success with source "scraped"', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('https://www.amazon.in/s?k=')) {
        return Promise.resolve(new Response(AMAZON_TILE_HTML, { status: 200 }));
      }
      if (url.startsWith('https://www.flipkart.com/search?q=')) {
        return Promise.resolve(new Response(FLIPKART_JSONLD_WITH_PRICE_HTML, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected fetch call to ${url}`));
    }) as typeof fetch;

    const { providers } = await runMarketplaceSearch('shirt', 'all');

    assertEquals(providers.amazon.status, 'success');
    assertEquals(providers.amazon.listings.length, 1);
    assertEquals(providers.amazon.listings[0].source, 'scraped');
    assertEquals(providers.amazon.listings[0].productUrl, 'https://www.amazon.in/dp/B0ORCHTEST1');

    assertEquals(providers.flipkart.status, 'success');
    assertEquals(providers.flipkart.listings.length, 1);
    assertEquals(providers.flipkart.listings[0].source, 'scraped');
    assertEquals(providers.flipkart.listings[0].productUrl, 'https://www.flipkart.com/orch-test-shirt/p/itmorch1');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('orchestrator: unconfigured provider whose scrape is blocked reports status "scrape_blocked"', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    globalThis.fetch = (() => Promise.resolve(new Response('<html><body>Robot Check</body></html>', { status: 200 }))) as typeof fetch;

    const { providers } = await runMarketplaceSearch('shirt', 'amazon');

    assertEquals(providers.amazon.status, 'scrape_blocked');
    assertEquals(providers.amazon.listings.length, 0);
    assert(typeof providers.amazon.message === 'string' && providers.amazon.message.includes("isn't connected yet"));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('orchestrator: unconfigured provider whose scrape throws reports status "scrape_failed"', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    globalThis.fetch = (() => Promise.reject(new Error('DNS resolution failed'))) as typeof fetch;

    const { providers } = await runMarketplaceSearch('shirt', 'flipkart');

    assertEquals(providers.flipkart.status, 'scrape_failed');
    assertEquals(providers.flipkart.listings.length, 0);
    assert(typeof providers.flipkart.message === 'string' && providers.flipkart.message.includes('DNS resolution failed'));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('orchestrator: MOCK_MARKETPLACES never triggers a real scrape (fetch call count stays zero)', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));
    Deno.env.set('MOCK_MARKETPLACES', 'true');

    let fetchCallCount = 0;
    globalThis.fetch = (() => {
      fetchCallCount++;
      return Promise.reject(new Error('fetch must never be called while MOCK_MARKETPLACES is active'));
    }) as typeof fetch;

    const { providers } = await runMarketplaceSearch('shirt', 'all');

    assertEquals(providers.amazon.status, 'mock');
    assertEquals(providers.flipkart.status, 'mock');
    // The only way scrapeAmazonSearch()/scrapeFlipkartSearch() could have
    // any effect is via a real fetch call — zero calls proves mock mode
    // short-circuited before either scraper (or provider.search) ran.
    assertEquals(fetchCallCount, 0, 'expected mock mode to short-circuit before any scrape attempt');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

// ---------------------------------------------------------------------------
// Scraped-field sanitization: name/brand/color/imageUrl/productUrl pulled
// out of a scraped page are length-capped and control-character-stripped
// before a listing is ever tagged `source: 'scraped'` — a hostile or
// malfunctioning third-party page (unlike the schema-shaped real affiliate
// API responses) could otherwise put an oversized or control-character-
// laden string straight into the DB and the API response.
// ---------------------------------------------------------------------------

const OVERSIZED_NAME = 'A'.repeat(5000) + '\u0007\u0001trailing-control-chars';
const LONG_PRODUCT_PATH = 'p'.repeat(3000);

const FLIPKART_OVERSIZED_FIELD_HTML = `<html><head>
<script type="application/ld+json">
${JSON.stringify({
  '@type': 'ItemList',
  itemListElement: [
    {
      name: OVERSIZED_NAME,
      url: `https://www.flipkart.com/orch-oversized-shirt/p/${LONG_PRODUCT_PATH}`,
      offers: { price: '499' },
    },
  ],
})}
</script>
</head><body></body></html>`;

Deno.test('orchestrator: scraped listing fields are length-capped and control-character-stripped before being tagged "scraped"', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    globalThis.fetch = (() => Promise.resolve(new Response(FLIPKART_OVERSIZED_FIELD_HTML, { status: 200 }))) as typeof fetch;

    const { providers } = await runMarketplaceSearch('shirt', 'flipkart');

    assertEquals(providers.flipkart.status, 'success');
    assertEquals(providers.flipkart.listings.length, 1);
    const listing = providers.flipkart.listings[0];

    assertEquals(listing.source, 'scraped');
    assert(listing.name.length <= 300, `expected name capped at 300 chars, got ${listing.name.length}`);
    // deno-lint-ignore no-control-regex
    assert(!/[\x00-\x1F\x7F]/.test(listing.name), 'expected control characters to be stripped from name');
    assertEquals(listing.name, 'A'.repeat(300));
    assert(listing.productUrl.length <= 2000, `expected productUrl capped at 2000 chars, got ${listing.productUrl.length}`);
    // Still a real, allowlisted flipkart.com URL after capping — truncation
    // only ever trims from the end, never touching the scheme+host prefix.
    assert(listing.productUrl.startsWith('https://www.flipkart.com/'));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});
