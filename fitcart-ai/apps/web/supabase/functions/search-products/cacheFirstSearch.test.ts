// Exercises resolveStoreWithCache end-to-end against a fake Supabase client
// (no real DB) and mocked `fetch` (no real network) — covers the three
// scenarios called out in this task: a sufficiently-cached store never
// touches the live/scrape path at all, a partially-cached store merges
// cache hits with fresh results without duplicates, and mock-source cache
// rows are never surfaced as hits.

import { assert, assertEquals } from './_testUtils.ts';
import { __resetTokenCacheForTests } from './amazonPaapi.ts';
import { resolveStoreWithCache } from './cacheFirstSearch.ts';
import { MIN_CACHE_RESULTS } from './localCatalog.ts';

const AMAZON_ENV_KEYS = ['AMAZON_CREATORS_CLIENT_ID', 'AMAZON_CREATORS_CLIENT_SECRET', 'AMAZON_CREATORS_PARTNER_TAG'] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(AMAZON_ENV_KEYS.map((k) => [k, Deno.env.get(k)]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const k of AMAZON_ENV_KEYS) {
    const v = snapshot[k];
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

interface FakeRow {
  name: string;
  brand: string | null;
  price: number;
  mrp: number;
  color: string | null;
  product_url: string | null;
  image_url: string | null;
  source: string;
}

// deno-lint-ignore no-explicit-any
function createFakeSupabase(cacheRowsByColumn: Record<string, FakeRow[]>): { client: any; upsertCalls: any[] } {
  const upsertCalls: unknown[] = [];
  const client = {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _storeValue: string) {
              return {
                ilike(column: string, _pattern: string) {
                  return {
                    limit(_n: number) {
                      return Promise.resolve({ data: cacheRowsByColumn[column] ?? [], error: null });
                    },
                  };
                },
              };
            },
          };
        },
        upsert(rows: unknown[], _opts: unknown) {
          upsertCalls.push(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, upsertCalls };
}

function realRow(i: number, overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    name: `Real Cotton Shirt ${i}`,
    brand: 'RealBrand',
    price: 500 + i,
    mrp: 900 + i,
    color: 'White',
    product_url: `https://www.amazon.in/dp/B0REAL${i}`,
    image_url: null,
    source: 'amazon-scraped',
    ...overrides,
  };
}

const AMAZON_TILE_HTML = `<html><body>
<div role="listitem" data-asin="B0FRESHTEST1" data-component-type="s-search-result">
  <a href="/dp/B0FRESHTEST1"><h2><span>Fresh Live Scraped Shirt</span></h2></a>
  <img class="s-image" src="https://m.media-amazon.com/images/fresh.jpg" />
  <span class="a-price" data-a-color="base"><span class="a-offscreen">₹549</span></span>
</div>
</body></html>`;

Deno.test('cacheFirstSearch: a store with >= MIN_CACHE_RESULTS cache hits never calls the live/scrape path at all', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    AMAZON_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    const rows = Array.from({ length: MIN_CACHE_RESULTS }, (_, i) => realRow(i));
    const { client, upsertCalls } = createFakeSupabase({ name: rows });

    let fetchCallCount = 0;
    globalThis.fetch = (() => {
      fetchCallCount++;
      return Promise.reject(new Error('fetch must never be called when the cache alone is sufficient'));
    }) as typeof fetch;

    const result = await resolveStoreWithCache(client, 'amazon', 'shirt', false);

    assertEquals(fetchCallCount, 0, 'expected the cache-sufficient path to skip the live/scrape attempt entirely');
    assertEquals(result.response.status, 'success');
    assertEquals(result.response.count, MIN_CACHE_RESULTS);
    assertEquals(result.response.upserted, 0);
    assertEquals(result.listings.length, MIN_CACHE_RESULTS);
    assert(typeof result.response.message === 'string' && result.response.message.includes('local catalog'));
    assertEquals(upsertCalls.length, 0, 'cache-sufficient rows are already persisted — must not be re-upserted');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('cacheFirstSearch: a store with fewer than MIN_CACHE_RESULTS cache hits merges them with fresh live results, deduped by productUrl', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    AMAZON_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    // Fewer than MIN_CACHE_RESULTS — below the skip-live threshold.
    const cachedRows = [realRow(1), realRow(2)];
    const { client } = createFakeSupabase({ name: cachedRows });

    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('https://www.amazon.in/s?k=')) {
        return Promise.resolve(new Response(AMAZON_TILE_HTML, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected fetch call to ${url}`));
    }) as typeof fetch;

    const result = await resolveStoreWithCache(client, 'amazon', 'shirt', false);

    // 2 cached + 1 freshly scraped, no overlapping productUrl -> 3 total.
    assertEquals(result.listings.length, 3);
    const urls = result.listings.map((l) => l.productUrl).sort();
    assertEquals(urls, [
      'https://www.amazon.in/dp/B0FRESHTEST1',
      'https://www.amazon.in/dp/B0REAL1',
      'https://www.amazon.in/dp/B0REAL2',
    ]);
    assertEquals(result.response.status, 'success');
    assert(typeof result.response.message === 'string' && result.response.message.includes('previously cached'));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('cacheFirstSearch: merging dedupes a fresh result that happens to match an already-cached productUrl', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    AMAZON_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    // Same productUrl the scraper will produce from AMAZON_TILE_HTML's ASIN.
    const cachedRows = [realRow(1, { product_url: 'https://www.amazon.in/dp/B0FRESHTEST1' })];
    const { client } = createFakeSupabase({ name: cachedRows });

    globalThis.fetch = (() => Promise.resolve(new Response(AMAZON_TILE_HTML, { status: 200 }))) as typeof fetch;

    const result = await resolveStoreWithCache(client, 'amazon', 'shirt', false);

    assertEquals(result.listings.length, 1, 'expected the duplicate productUrl to be deduped, not counted twice');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('cacheFirstSearch: mock-source cache rows never count toward the cache-sufficient threshold or appear in results', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    AMAZON_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    const mockRows = Array.from({ length: MIN_CACHE_RESULTS }, (_, i) =>
      realRow(i, { source: 'amazon-mock', product_url: `https://example.com/mock-listing/amazon/amazon-${i}` }));
    const { client } = createFakeSupabase({ name: mockRows });

    globalThis.fetch = (() => Promise.resolve(new Response('<html><body>blocked</body></html>', { status: 200 }))) as typeof fetch;

    const result = await resolveStoreWithCache(client, 'amazon', 'shirt', false);

    assert(!result.listings.some((l) => l.productUrl.includes('example.com')), 'mock cache row leaked into results');
    // With every cache row excluded as mock, this must NOT take the
    // cache-sufficient short-circuit — it should have fallen through to
    // (and reported) the live/scrape attempt.
    assertEquals(result.response.status, 'scrape_blocked');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('cacheFirstSearch: mock mode bypasses the cache entirely, even when real cache rows exist', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    AMAZON_ENV_KEYS.forEach((k) => Deno.env.delete(k));

    const rows = Array.from({ length: MIN_CACHE_RESULTS }, (_, i) => realRow(i));
    const { client } = createFakeSupabase({ name: rows });

    let fetchCallCount = 0;
    globalThis.fetch = (() => {
      fetchCallCount++;
      return Promise.reject(new Error('fetch must never be called while mock mode is active'));
    }) as typeof fetch;

    const result = await resolveStoreWithCache(client, 'amazon', 'shirt', true);

    assertEquals(fetchCallCount, 0);
    assertEquals(result.response.status, 'mock');
    assert(result.listings.length > 0);
    for (const listing of result.listings) {
      assertEquals(listing.source, 'mock');
      assert(!listing.productUrl.includes('B0REAL'), 'real cache rows must not leak into mock-mode results');
    }
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});
