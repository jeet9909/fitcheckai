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

Deno.test('orchestrator: unconfigured providers return not_configured without throwing', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    ALL_ENV_KEYS.forEach((k) => Deno.env.delete(k));
    globalThis.fetch = (() => Promise.reject(new Error('fetch should never be called when unconfigured'))) as typeof fetch;

    const { results, providers } = await runMarketplaceSearch('shirt', 'all');

    assertEquals(providers.amazon.status, 'not_configured');
    assertEquals(providers.flipkart.status, 'not_configured');
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
