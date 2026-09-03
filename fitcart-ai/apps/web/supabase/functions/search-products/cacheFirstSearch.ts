// Cache-first per-store search resolution — the layer between index.ts's
// HTTP handler and the lower-level building blocks (localCatalog.ts's DB
// lookup, orchestrator.ts's runProvider real-API/scrape attempt,
// persistCatalog.ts's upsert). Pulled into its own module (rather than left
// inline in index.ts) specifically so it's unit-testable with a fake
// Supabase client + mocked `fetch`, without needing a real DB connection or
// hitting index.ts's module-scope `createClient(...)` call.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { findCachedListings, MIN_CACHE_RESULTS } from './localCatalog.ts';
import { PROVIDERS, runProvider, type Store } from './orchestrator.ts';
import { upsertAndReport, type ProviderResponse } from './persistCatalog.ts';
import type { StoreListing } from './types.ts';

// How many existing catalog rows to look at per store when deciding whether
// the cache alone is "enough" (see MIN_CACHE_RESULTS) — distinct from that
// threshold itself: this is a page size for the lookup, not the bar for
// skipping a live fetch.
export const CACHE_LOOKUP_LIMIT = 20;

// Merges cache hits with freshly-fetched listings, deduping by productUrl —
// used when a store's cache has some but fewer than MIN_CACHE_RESULTS real
// matches, so those hits are never simply discarded in favor of whatever a
// live scrape/API call happens to return this time.
export function mergeByProductUrl(cached: StoreListing[], fresh: StoreListing[]): StoreListing[] {
  const seen = new Set<string>();
  const merged: StoreListing[] = [];
  for (const listing of [...cached, ...fresh]) {
    if (seen.has(listing.productUrl)) continue;
    seen.add(listing.productUrl);
    merged.push(listing);
  }
  return merged;
}

function cacheOnlyMessage(count: number, label: string): string {
  const noun = count === 1 ? 'result' : 'results';
  return `Served ${count} ${noun} from the local catalog (previously fetched) — no new live request was made to ${label} this time.`;
}

function appendCacheNote(message: string | undefined, cachedCount: number): string | undefined {
  if (cachedCount === 0) return message;
  const noun = cachedCount === 1 ? 'result' : 'results';
  const note = `Also included ${cachedCount} previously cached ${noun} for this store.`;
  return message ? `${message} ${note}` : note;
}

export interface StoreSearchResult {
  listings: StoreListing[];
  response: ProviderResponse;
}

// Resolves one store's listings + reportable outcome using the cache-first
// strategy: local catalog first (skipping the live/scrape attempt entirely
// once there are at least MIN_CACHE_RESULTS real matches), then a real
// API/scrape attempt merged with whatever partial cache hits existed.
// Mirrors runProvider's isolation guarantee: never throws, so a Promise.all
// over every requested store can't have one store's failure blank out the
// others.
export async function resolveStoreWithCache(
  supabaseAdmin: SupabaseClient,
  store: Store,
  query: string,
  mock: boolean,
): Promise<StoreSearchResult> {
  const label = PROVIDERS[store].label;

  // Mock mode intentionally bypasses the cache entirely — it exists to
  // exercise/demo the search UI without touching real data at all, and
  // mixing in real cached rows would blur that boundary (see mockData.ts's
  // own "never enable in production" warning).
  const cached = mock ? [] : await findCachedListings(supabaseAdmin, store, query, CACHE_LOOKUP_LIMIT);

  if (!mock && cached.length >= MIN_CACHE_RESULTS) {
    return {
      listings: cached,
      response: {
        status: 'success',
        count: cached.length,
        upserted: 0,
        message: cacheOnlyMessage(cached.length, label),
      },
    };
  }

  const liveResult = await runProvider(store, query, mock);
  const merged = mergeByProductUrl(cached, liveResult.listings);
  const reported = await upsertAndReport(supabaseAdmin, store, liveResult);

  return {
    listings: merged,
    response: {
      ...reported,
      count: merged.length,
      message: appendCacheNote(reported.message, cached.length),
    },
  };
}
