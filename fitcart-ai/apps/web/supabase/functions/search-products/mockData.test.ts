import { assert, assertEquals } from './_testUtils.ts';
import { generateMockListings, isMockMode } from './mockData.ts';

Deno.test('mockData: isMockMode reads MOCK_MARKETPLACES', () => {
  const original = Deno.env.get('MOCK_MARKETPLACES');
  try {
    Deno.env.delete('MOCK_MARKETPLACES');
    assertEquals(isMockMode(), false);

    Deno.env.set('MOCK_MARKETPLACES', 'true');
    assertEquals(isMockMode(), true);

    Deno.env.set('MOCK_MARKETPLACES', 'TRUE');
    assertEquals(isMockMode(), true);

    Deno.env.set('MOCK_MARKETPLACES', 'false');
    assertEquals(isMockMode(), false);

    Deno.env.set('MOCK_MARKETPLACES', '');
    assertEquals(isMockMode(), false);
  } finally {
    if (original === undefined) Deno.env.delete('MOCK_MARKETPLACES');
    else Deno.env.set('MOCK_MARKETPLACES', original);
  }
});

Deno.test('mockData: generateMockListings tags every listing source: mock', () => {
  const listings = generateMockListings('Amazon', 'blue shirt');
  assert(listings.length > 0, 'expected at least one mock listing');
  for (const listing of listings) {
    assertEquals(listing.source, 'mock');
    assertEquals(listing.store, 'Amazon');
  }
});

Deno.test('mockData: generateMockListings uses only obviously-fake example.com URLs', () => {
  for (const store of ['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'AJIO', 'Nykaa Fashion'] as const) {
    const listings = generateMockListings(store, 'jeans');
    for (const listing of listings) {
      assert(listing.productUrl.startsWith('https://example.com/'), `unexpected productUrl: ${listing.productUrl}`);
      assert(listing.imageUrl?.startsWith('https://example.com/'), `unexpected imageUrl: ${listing.imageUrl}`);
      // Never a real marketplace domain, under any circumstance.
      assert(!listing.productUrl.includes('amazon.in'));
      assert(!listing.productUrl.includes('flipkart.com'));
      assert(!listing.productUrl.includes('meesho.com'));
      assert(!listing.productUrl.includes('myntra.com'));
      assert(!listing.productUrl.includes('ajio.com'));
      assert(!listing.productUrl.includes('nykaafashion.com'));
    }
  }
});

Deno.test('mockData: generateMockListings returns at least one listing for all 6 stores', () => {
  for (const store of ['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'AJIO', 'Nykaa Fashion'] as const) {
    const listings = generateMockListings(store, 'shirt');
    assert(listings.length > 0, `expected at least one mock listing for ${store}`);
    for (const listing of listings) {
      assertEquals(listing.store, store);
      assertEquals(listing.source, 'mock');
    }
  }
});

Deno.test('mockData: generateMockListings is deterministic for the same input', () => {
  const first = generateMockListings('Flipkart', 'red dress');
  const second = generateMockListings('Flipkart', 'red dress');
  assertEquals(first, second);
});

Deno.test('mockData: generateMockListings reflects the query in the listing name', () => {
  const listings = generateMockListings('Amazon', 'formal trousers');
  for (const listing of listings) {
    assert(listing.name.includes('formal trousers'), `expected query in name, got: ${listing.name}`);
  }
});
