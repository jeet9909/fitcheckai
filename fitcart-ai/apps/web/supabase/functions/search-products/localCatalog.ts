// Local-cache-first search: before ever hitting a real affiliate API or
// live-scraping a store's search-results page (both slow and, per the
// scraping fallback's live-tested findings, frequently blocked), check
// whether the `products` table already has enough real rows for this
// (store, query) pair — rows created either by a previous search-products
// invocation or by fetch-product's single-URL paste flow. See index.ts for
// how the threshold (`MIN_CACHE_RESULTS`) decides whether a cache hit alone
// is enough or needs merging with a fresh live/scrape attempt.
//
// Deliberately built on the Supabase JS query builder's own `.ilike()`
// method (never raw string concatenation into a `.filter()`/SQL string) —
// see escapeLikeWildcards below for why the query text itself still needs
// sanitizing even so: `%`/`_` are live ILIKE wildcards, not just RLS/SQL-
// injection-adjacent characters, so an unescaped `%` in a user's search term
// would silently match *every* row for that store, which is a correctness
// bug (a search for "%" returning the whole catalog), not merely a
// hardening nicety.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PROVIDERS, type Store } from './orchestrator.ts';
import type { StoreListing } from './types.ts';

// Minimum number of real (non-mock) cache matches for a store before
// index.ts treats the cache alone as sufficient and skips the live
// scrape/API call for that store entirely. Exported so index.ts and this
// module's own tests share one source of truth for the threshold.
export const MIN_CACHE_RESULTS = 5;

// Postgres ILIKE treats `%` (match any run of characters) and `_` (match
// exactly one character) as wildcards, and `\` as ILIKE's own escape
// character. A search term containing any of these needs them escaped
// *before* being wrapped in `%...%`, or a user searching for e.g. "50% off"
// or "a_b" would get wildcard behavior they never asked for (and, in the
// `%` case, effectively an unfiltered "match everything" query against that
// store's whole catalog).
export function escapeLikeWildcards(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

const CACHE_SELECT_COLUMNS = 'name, brand, price, mrp, color, product_url, image_url, source';

interface ProductRow {
  name: string;
  brand: string | null;
  price: number;
  mrp: number;
  color: string | null;
  product_url: string | null;
  image_url: string | null;
  source: string;
}

// A cache row counts as "scraped" (not "live") if its source is exactly the
// plain 'scraped' fetch-product writes, or ends in the `-scraped` suffix
// search-products' own scraping fallback writes (see orchestrator.ts /
// index.ts's upsertListings) — either way, it did not come from a real,
// credentialed affiliate API, and D-014 forbids presenting it as more
// trustworthy than that.
function sourceToListingSource(source: string): 'live' | 'scraped' {
  return source === 'scraped' || source.endsWith('-scraped') ? 'scraped' : 'live';
}

// Rows with `source` ending in `-mock` are demo/dev data generated in-
// process by mockData.ts, sharing one fixed product_url per template (see
// mockData.ts's own comment) — they must never be surfaced as if they were
// a real previously-fetched catalog hit.
function isMockSource(source: string): boolean {
  return source.endsWith('-mock');
}

function rowToListing(row: ProductRow, listingStore: StoreListing['store']): StoreListing | null {
  // A cache row with no real outbound link isn't usable as a listing (the
  // frontend renders productUrl as the "buy now" link) — this shouldn't
  // happen for rows that made it through the allowlist on the way in, but
  // treated defensively rather than assumed here.
  if (!row.product_url) return null;

  return {
    name: row.name,
    brand: row.brand ?? 'Unknown',
    price: row.price,
    mrp: row.mrp,
    color: row.color ?? '',
    imageUrl: row.image_url ?? null,
    productUrl: row.product_url,
    store: listingStore,
    source: sourceToListingSource(row.source),
  };
}

// Runs one ILIKE lookup against a single column, never throwing — a DB
// error here is logged and treated as "no cache hits from this column",
// same honesty-preserving-by-omission convention as the rest of this
// codebase's fallback paths (never surfaces a DB error as if it were an
// empty-but-successful cache).
async function ilikeColumn(
  supabaseAdmin: SupabaseClient,
  listingStore: StoreListing['store'],
  column: 'name' | 'brand' | 'category',
  pattern: string,
  limit: number,
): Promise<ProductRow[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(CACHE_SELECT_COLUMNS)
    .eq('store', listingStore)
    .ilike(column, pattern)
    .limit(limit);

  if (error) {
    console.error(`[search-products] local catalog lookup failed for ${listingStore} (column: ${column}):`, error);
    return [];
  }

  return (data ?? []) as unknown as ProductRow[];
}

// Looks up already-catalogued, non-mock rows for `store` whose name, brand,
// or category loosely matches `query` — used by index.ts as the first thing
// tried for every requested store, before any live scrape/API call.
export async function findCachedListings(
  supabaseAdmin: SupabaseClient,
  store: Store,
  query: string,
  limit: number,
): Promise<StoreListing[]> {
  const listingStore = PROVIDERS[store].listingStore;
  const trimmed = query.trim();
  if (!trimmed || limit <= 0) return [];

  const pattern = `%${escapeLikeWildcards(trimmed)}%`;

  // Three independent single-column queries (each already scoped to `store`
  // and capped at `limit`) rather than one `.or(...)` filter string — this
  // sidesteps ever having to reason about escaping a user-controlled value
  // for PostgREST's `.or()` mini-grammar (which uses its own comma/paren
  // syntax on top of SQL's), while still only ever using the query
  // builder's own `.ilike()` method, never raw string concatenation.
  const [byName, byBrand, byCategory] = await Promise.all([
    ilikeColumn(supabaseAdmin, listingStore, 'name', pattern, limit),
    ilikeColumn(supabaseAdmin, listingStore, 'brand', pattern, limit),
    ilikeColumn(supabaseAdmin, listingStore, 'category', pattern, limit),
  ]);

  const seenUrls = new Set<string>();
  const listings: StoreListing[] = [];

  for (const row of [...byName, ...byBrand, ...byCategory]) {
    if (isMockSource(row.source)) continue;
    if (!row.product_url || seenUrls.has(row.product_url)) continue;

    const listing = rowToListing(row, listingStore);
    if (!listing) continue;

    seenUrls.add(row.product_url);
    listings.push(listing);
    if (listings.length >= limit) break;
  }

  return listings;
}
