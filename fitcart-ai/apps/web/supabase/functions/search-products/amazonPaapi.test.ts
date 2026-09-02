// Mocks globalThis.fetch for both the OAuth token endpoint and the search
// endpoint — no real network call is ever made. Do not remove the mock and
// point this at live Amazon endpoints; no credentials exist in this repo.

import { assert, assertEquals } from './_testUtils.ts';
import { __resetTokenCacheForTests, isAmazonConfigured, searchAmazon } from './amazonPaapi.ts';

const ENV_KEYS = [
  'AMAZON_CREATORS_CLIENT_ID',
  'AMAZON_CREATORS_CLIENT_SECRET',
  'AMAZON_CREATORS_PARTNER_TAG',
  'AMAZON_CREATORS_TOKEN_URL',
  'AMAZON_CREATORS_MARKETPLACE',
] as const;

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

function setConfiguredEnv() {
  Deno.env.set('AMAZON_CREATORS_CLIENT_ID', 'amzn1.application-oa2-client.test');
  Deno.env.set('AMAZON_CREATORS_CLIENT_SECRET', 'test-client-secret-do-not-leak');
  Deno.env.set('AMAZON_CREATORS_PARTNER_TAG', 'testtag-21');
}

function mockTokenAndSearchFetch(searchResponseBody: unknown) {
  let tokenCalls = 0;
  let searchCalls = 0;
  let lastTokenInit: RequestInit | undefined;
  let lastSearchInit: RequestInit | undefined;

  const fetchMock = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/auth/o2/token')) {
      tokenCalls++;
      lastTokenInit = init;
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600, token_type: 'bearer' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (url.includes('creatorsapi.amazon/catalog/v1/searchItems')) {
      searchCalls++;
      lastSearchInit = init;
      return Promise.resolve(
        new Response(JSON.stringify(searchResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.reject(new Error(`Unexpected fetch call to ${url} — no real network call should happen in tests`));
  };

  return {
    fetchMock,
    get tokenCalls() { return tokenCalls; },
    get searchCalls() { return searchCalls; },
    get lastTokenInit() { return lastTokenInit; },
    get lastSearchInit() { return lastSearchInit; },
  };
}

const SAMPLE_RESPONSE = {
  searchResult: {
    items: [
      {
        itemInfo: {
          title: { displayValue: 'Test Cotton Shirt' },
          byLineInfo: { brand: { displayValue: 'TestBrand' } },
        },
        images: { primary: { large: { url: 'https://m.media-amazon.com/images/test.jpg' } } },
        offers: { listings: [{ price: { amount: 999 }, savingBasis: { amount: 1499 } }] },
        detailPageUrl: 'https://www.amazon.in/dp/TEST123',
      },
      {
        // Missing title -> must be filtered out by normalization.
        itemInfo: {},
        detailPageUrl: 'https://www.amazon.in/dp/NOTITLE',
      },
    ],
  },
};

Deno.test('amazonPaapi: isAmazonConfigured reflects the new Creators API env vars', () => {
  const snapshot = snapshotEnv();
  try {
    ENV_KEYS.forEach((k) => Deno.env.delete(k));
    assertEquals(isAmazonConfigured(), false);

    setConfiguredEnv();
    assertEquals(isAmazonConfigured(), true);

    Deno.env.delete('AMAZON_CREATORS_PARTNER_TAG');
    assertEquals(isAmazonConfigured(), false);
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test('amazonPaapi: searchAmazon sends a Bearer token and lowerCamelCase request body', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    setConfiguredEnv();
    const mock = mockTokenAndSearchFetch(SAMPLE_RESPONSE);
    globalThis.fetch = mock.fetchMock as typeof fetch;

    await searchAmazon('cotton shirt');

    assertEquals(mock.searchCalls, 1);
    const headers = mock.lastSearchInit?.headers as Record<string, string>;
    assert(headers.Authorization === 'Bearer test-access-token', `unexpected Authorization header: ${headers.Authorization}`);
    assertEquals(headers['x-marketplace'], 'www.amazon.in');
    assertEquals(headers['Content-Type'], 'application/json');

    const body = JSON.parse(mock.lastSearchInit?.body as string);
    assertEquals(body.keywords, 'cotton shirt');
    assertEquals(body.partnerTag, 'testtag-21');
    assertEquals(body.marketplace, 'www.amazon.in');
    assert(Array.isArray(body.resources) && body.resources.length > 0, 'expected non-empty resources array');
    assert(body.resources.every((r: string) => r === r.toLowerCase() || /^[a-z]/.test(r)), 'resources should be lowerCamelCase, not PascalCase');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('amazonPaapi: caches the OAuth token across multiple search calls', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    setConfiguredEnv();
    const mock = mockTokenAndSearchFetch(SAMPLE_RESPONSE);
    globalThis.fetch = mock.fetchMock as typeof fetch;

    await searchAmazon('shirt');
    await searchAmazon('shirt');

    assertEquals(mock.tokenCalls, 1, 'expected the token endpoint to be hit only once across two searches');
    assertEquals(mock.searchCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('amazonPaapi: normalizes a Creators API response into StoreListing[], dropping items missing a title', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    setConfiguredEnv();
    const mock = mockTokenAndSearchFetch(SAMPLE_RESPONSE);
    globalThis.fetch = mock.fetchMock as typeof fetch;

    const listings = await searchAmazon('shirt');

    assertEquals(listings.length, 1);
    const listing = listings[0];
    assertEquals(listing.name, 'Test Cotton Shirt');
    assertEquals(listing.brand, 'TestBrand');
    assertEquals(listing.price, 999);
    assertEquals(listing.mrp, 1499);
    assertEquals(listing.imageUrl, 'https://m.media-amazon.com/images/test.jpg');
    assertEquals(listing.productUrl, 'https://www.amazon.in/dp/TEST123');
    assertEquals(listing.store, 'Amazon');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});

Deno.test('amazonPaapi: token request body never leaks into a thrown error on failure', async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = globalThis.fetch;
  __resetTokenCacheForTests();
  try {
    setConfiguredEnv();
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/o2/token')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'invalid_client', error_description: 'bad credentials' }), { status: 401 }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch call to ${url}`));
    }) as typeof fetch;

    let thrown: unknown;
    try {
      await searchAmazon('shirt');
    } catch (err) {
      thrown = err;
    }
    assert(thrown instanceof Error, 'expected searchAmazon to throw');
    const message = (thrown as Error).message;
    assert(!message.includes('test-client-secret-do-not-leak'), 'client secret leaked into thrown error message');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(envSnapshot);
    __resetTokenCacheForTests();
  }
});
