// Mocks globalThis.fetch — no real network call is ever made. Flipkart's
// Affiliate API 1.0 request shape is unchanged (confirmed current against
// https://affiliate.flipkart.com/api-docs/af_prod_ref.html), so this test
// only needs to cover the existing behavior, not a migration.

import { assert, assertEquals } from './_testUtils.ts';
import { isFlipkartConfigured, searchFlipkart } from './flipkartAffiliate.ts';

const ENV_KEYS = ['FLIPKART_AFFILIATE_ID', 'FLIPKART_AFFILIATE_TOKEN'] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, Deno.env.get(k)]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    const v = snapshot[k];
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

const SAMPLE_RESPONSE = {
  products: [
    {
      productBaseInfoV1: {
        title: 'Test Denim Jacket',
        brand: 'TestBrand',
        imageUrls: { '200x200': 'https://rukminim.flixcart.com/image/test.jpg' },
        maximumRetailPrice: { amount: 2999 },
        flipkartSellingPrice: { amount: 1999 },
        productUrl: 'https://www.flipkart.com/test-denim-jacket/p/itm123',
        inStock: true,
      },
    },
    {
      // Missing productUrl -> must be filtered out.
      productBaseInfoV1: { title: 'No URL Item' },
    },
  ],
};

Deno.test('flipkartAffiliate: isFlipkartConfigured requires both env vars', () => {
  const snapshot = snapshotEnv();
  try {
    ENV_KEYS.forEach((k) => Deno.env.delete(k));
    assertEquals(isFlipkartConfigured(), false);

    Deno.env.set('FLIPKART_AFFILIATE_ID', 'id123');
    assertEquals(isFlipkartConfigured(), false);

    Deno.env.set('FLIPKART_AFFILIATE_TOKEN', 'token123');
    assertEquals(isFlipkartConfigured(), true);
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test('flipkartAffiliate: searchFlipkart sends affiliate headers and URL-encodes the query', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    Deno.env.set('FLIPKART_AFFILIATE_ID', 'id123');
    Deno.env.set('FLIPKART_AFFILIATE_TOKEN', 'token-abc');

    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof input === 'string' ? input : input.toString();
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return Promise.resolve(
        new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }) as typeof fetch;

    await searchFlipkart('men\'s shirt & tie');

    assert(capturedUrl.startsWith('https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query='));
    assert(capturedUrl.includes(encodeURIComponent('men\'s shirt & tie')), `query not properly encoded: ${capturedUrl}`);
    assertEquals(capturedHeaders['Fk-Affiliate-Id'], 'id123');
    assertEquals(capturedHeaders['Fk-Affiliate-Token'], 'token-abc');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
  }
});

Deno.test('flipkartAffiliate: normalizes a response into StoreListing[], dropping items missing a URL', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    Deno.env.set('FLIPKART_AFFILIATE_ID', 'id123');
    Deno.env.set('FLIPKART_AFFILIATE_TOKEN', 'token-abc');

    globalThis.fetch = (() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 }))) as typeof fetch;

    const listings = await searchFlipkart('denim jacket');

    assertEquals(listings.length, 1);
    const listing = listings[0];
    assertEquals(listing.name, 'Test Denim Jacket');
    assertEquals(listing.brand, 'TestBrand');
    assertEquals(listing.price, 1999);
    assertEquals(listing.mrp, 2999);
    assertEquals(listing.productUrl, 'https://www.flipkart.com/test-denim-jacket/p/itm123');
    assertEquals(listing.store, 'Flipkart');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
  }
});

Deno.test('flipkartAffiliate: throws (does not swallow) on a non-OK response', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  try {
    Deno.env.set('FLIPKART_AFFILIATE_ID', 'id123');
    Deno.env.set('FLIPKART_AFFILIATE_TOKEN', 'token-abc');

    globalThis.fetch = (() =>
      Promise.resolve(new Response('unauthorized', { status: 401 }))) as typeof fetch;

    let thrown: unknown;
    try {
      await searchFlipkart('shirt');
    } catch (err) {
      thrown = err;
    }
    assert(thrown instanceof Error);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
  }
});
