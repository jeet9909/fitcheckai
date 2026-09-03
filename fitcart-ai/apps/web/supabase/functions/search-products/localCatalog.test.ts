// Mocks the Supabase client's query-builder chain — no real DB call is ever
// made. Covers: the query is built via .eq()/.ilike() (never raw string
// concatenation), `%`/`_` wildcard escaping, mock-row exclusion, and the
// row -> StoreListing mapping (including the live-vs-scraped source rule).

import { assert, assertEquals } from './_testUtils.ts';
import { escapeLikeWildcards, findCachedListings, MIN_CACHE_RESULTS } from './localCatalog.ts';

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

interface RecordedCall {
  store: string;
  column: string;
  pattern: string;
  limit: number;
}

// deno-lint-ignore no-explicit-any
function createFakeSupabase(rowsByColumn: Record<string, FakeRow[]>, calls: RecordedCall[]): any {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, storeValue: string) {
              return {
                ilike(column: string, pattern: string) {
                  return {
                    limit(n: number) {
                      calls.push({ store: storeValue, column, pattern, limit: n });
                      return Promise.resolve({ data: rowsByColumn[column] ?? [], error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test('localCatalog: escapeLikeWildcards escapes %, _, and backslash', () => {
  assertEquals(escapeLikeWildcards('50% off'), '50\\% off');
  assertEquals(escapeLikeWildcards('a_b'), 'a\\_b');
  assertEquals(escapeLikeWildcards('back\\slash'), 'back\\\\slash');
  assertEquals(escapeLikeWildcards('100%_done'), '100\\%\\_done');
});

Deno.test('localCatalog: MIN_CACHE_RESULTS is exported as a named constant', () => {
  assertEquals(MIN_CACHE_RESULTS, 5);
});

Deno.test('localCatalog: builds one .eq(store)+.ilike(column) query per column via the query builder, never raw string concatenation', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase({}, calls);

  await findCachedListings(fake, 'amazon', 'shirt', 10);

  assertEquals(calls.length, 3);
  const columns = calls.map((c) => c.column).sort();
  assertEquals(columns, ['brand', 'category', 'name']);
  for (const call of calls) {
    assertEquals(call.store, 'Amazon');
    assertEquals(call.pattern, '%shirt%');
    assertEquals(call.limit, 10);
  }
});

Deno.test('localCatalog: a query containing literal % and _ is escaped before being wrapped in wildcards', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase({}, calls);

  await findCachedListings(fake, 'flipkart', '50% off_deal', 5);

  assert(calls.length > 0);
  for (const call of calls) {
    assertEquals(call.pattern, '%50\\% off\\_deal%');
  }
});

Deno.test('localCatalog: an empty/whitespace-only query returns no results without ever querying the DB', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase({}, calls);

  const listings = await findCachedListings(fake, 'amazon', '   ', 10);

  assertEquals(listings, []);
  assertEquals(calls.length, 0);
});

Deno.test('localCatalog: mock rows (source ending in "-mock") are never returned as cache hits', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase(
    {
      name: [
        {
          name: '[MOCK] shirt — MockWear',
          brand: 'MockWear',
          price: 799,
          mrp: 1299,
          color: 'Blue',
          product_url: 'https://example.com/mock-listing/amazon/amazon-1',
          image_url: 'https://example.com/mock-image/amazon/amazon-1.jpg',
          source: 'amazon-mock',
        },
        {
          name: 'Real Cotton Shirt',
          brand: 'RealBrand',
          price: 599,
          mrp: 999,
          color: 'White',
          product_url: 'https://www.amazon.in/dp/B0REAL1',
          image_url: 'https://m.media-amazon.com/images/real.jpg',
          source: 'amazon-scraped',
        },
      ],
    },
    calls,
  );

  const listings = await findCachedListings(fake, 'amazon', 'shirt', 10);

  assertEquals(listings.length, 1);
  assertEquals(listings[0].productUrl, 'https://www.amazon.in/dp/B0REAL1');
  assert(!listings.some((l) => l.productUrl.includes('example.com')), 'mock row leaked into cache results');
});

Deno.test('localCatalog: maps a real row to a StoreListing, defaulting brand/color and deduping across columns by productUrl', async () => {
  const sharedRow: FakeRow = {
    name: 'Classic Denim Jacket',
    brand: null,
    price: 1499,
    mrp: 2499,
    color: null,
    product_url: 'https://www.flipkart.com/classic-denim-jacket/p/itm1',
    image_url: 'https://rukminim.flixcart.com/image/jacket.jpg',
    source: 'flipkart-scraped',
  };
  const calls: RecordedCall[] = [];
  // Same row appears in both the name-match and brand-match results (as it
  // would for a real store/query where the term shows up in both columns) —
  // must be deduped to a single listing.
  const fake = createFakeSupabase({ name: [sharedRow], brand: [sharedRow] }, calls);

  const listings = await findCachedListings(fake, 'flipkart', 'denim', 10);

  assertEquals(listings.length, 1);
  const listing = listings[0];
  assertEquals(listing.name, 'Classic Denim Jacket');
  assertEquals(listing.brand, 'Unknown');
  assertEquals(listing.color, '');
  assertEquals(listing.price, 1499);
  assertEquals(listing.mrp, 2499);
  assertEquals(listing.productUrl, 'https://www.flipkart.com/classic-denim-jacket/p/itm1');
  assertEquals(listing.store, 'Flipkart');
  assertEquals(listing.source, 'scraped');
});

Deno.test('localCatalog: a row with source exactly "scraped" (fetch-product\'s paste-a-link flow) is mapped to source "scraped", not "live"', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase(
    {
      name: [
        {
          name: 'Pasted Link Kurta',
          brand: 'SomeBrand',
          price: 899,
          mrp: 1299,
          color: 'Red',
          product_url: 'https://www.meesho.com/pasted-kurta/p/abc',
          image_url: null,
          source: 'scraped',
        },
      ],
    },
    calls,
  );

  const listings = await findCachedListings(fake, 'meesho', 'kurta', 10);

  assertEquals(listings.length, 1);
  assertEquals(listings[0].source, 'scraped');
});

Deno.test('localCatalog: a row with source "curated" or "<store>-affiliate" is mapped to source "live"', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase(
    {
      name: [
        {
          name: 'Curated Shirt',
          brand: 'Brand',
          price: 999,
          mrp: 1499,
          color: 'Black',
          product_url: 'https://www.amazon.in/dp/B0CURATED1',
          image_url: null,
          source: 'curated',
        },
        {
          name: 'Affiliate Shirt',
          brand: 'Brand',
          price: 799,
          mrp: 1199,
          color: 'Blue',
          product_url: 'https://www.amazon.in/dp/B0AFFIL1',
          image_url: null,
          source: 'amazon-affiliate',
        },
      ],
    },
    calls,
  );

  const listings = await findCachedListings(fake, 'amazon', 'shirt', 10);

  assertEquals(listings.length, 2);
  for (const listing of listings) {
    assertEquals(listing.source, 'live');
  }
});

Deno.test('localCatalog: a row with no product_url is dropped rather than returned with a broken link', async () => {
  const calls: RecordedCall[] = [];
  const fake = createFakeSupabase(
    {
      name: [
        {
          name: 'No URL Product',
          brand: 'Brand',
          price: 500,
          mrp: 700,
          color: '',
          product_url: null,
          image_url: null,
          source: 'curated',
        },
      ],
    },
    calls,
  );

  const listings = await findCachedListings(fake, 'amazon', 'shirt', 10);

  assertEquals(listings, []);
});

Deno.test('localCatalog: results are capped at the requested limit even when more matches exist across columns', async () => {
  const calls: RecordedCall[] = [];
  const rows: FakeRow[] = Array.from({ length: 8 }, (_, i) => ({
    name: `Shirt ${i}`,
    brand: 'Brand',
    price: 500 + i,
    mrp: 700 + i,
    color: '',
    product_url: `https://www.amazon.in/dp/B0ITEM${i}`,
    image_url: null,
    source: 'amazon-scraped',
  }));
  const fake = createFakeSupabase({ name: rows }, calls);

  const listings = await findCachedListings(fake, 'amazon', 'shirt', 3);

  assertEquals(listings.length, 3);
});
