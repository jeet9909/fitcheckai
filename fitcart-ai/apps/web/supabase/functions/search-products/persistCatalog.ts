// Shared catalog-persistence helpers — extracted out of index.ts so
// populate-catalog (a separate Edge Function that pre-warms the catalog for
// a batch of search terms) can reuse the exact same upsert/report logic
// instead of duplicating it. Behavior is unchanged from when this lived in
// index.ts.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ProviderResult, Store } from './orchestrator.ts';
import type { StoreListing } from './types.ts';

// Upserts one provider's listings only — a failure here downgrades that
// provider's own status to 'error' (handled by the caller) without ever
// touching, or being able to lose, another provider's already-fetched rows.
export async function upsertListings(supabaseAdmin: SupabaseClient, store: Store, listings: StoreListing[]): Promise<number> {
  if (listings.length === 0) return 0;
  const { error } = await supabaseAdmin.from('products').upsert(
    listings.map((l) => ({
      name: l.name,
      brand: l.brand,
      store: l.store,
      category: 'Unknown',
      price: l.price,
      mrp: l.mrp,
      color: l.color,
      product_url: l.productUrl,
      image_url: l.imageUrl,
      // Reuses the existing free-text `source` column (no schema change) —
      // mock listings get a distinct `-mock` suffix and scraped listings a
      // `-scraped` suffix so they're at least grep-able/filterable even
      // though there's no structural (FK/enum) separation from real
      // affiliate-API rows. See schema.sql and README for the "never enable
      // MOCK_MARKETPLACES in production" warning; scraped rows carry a
      // real, allowlist-checked store URL, so — unlike mock — they're safe
      // to persist as real catalog data (see upsertAndReport below).
      source: `${store}-${l.source === 'mock' ? 'mock' : l.source === 'scraped' ? 'scraped' : 'affiliate'}`,
      scraped_at: new Date().toISOString(),
    })),
    { onConflict: 'product_url' },
  );
  if (error) throw error;
  return listings.length;
}

export interface ProviderResponse {
  status: ProviderResult['status'];
  count: number;
  upserted: number;
  message?: string;
}

export async function upsertAndReport(supabaseAdmin: SupabaseClient, store: Store, result: ProviderResult): Promise<ProviderResponse> {
  const base: ProviderResponse = {
    status: result.status,
    count: result.listings.length,
    upserted: 0,
    ...(result.message ? { message: result.message } : {}),
  };

  // Mock listings are never persisted: every mock row for a given store
  // shares one fixed product_url (see mockData.ts), so upserting them would
  // let one search's demo text stomp on the next search's demo text in the
  // shared catalog — different queries (or different users) would silently
  // overwrite each other's mock rows. They're returned in `results` for the
  // search panel to render, but the shared products table stays real-only.
  //
  // Scraped listings (result.status === 'success' with source: 'scraped')
  // are NOT skipped here and fall through to the normal upsert path below —
  // unlike mock data, they point at real, allowlist-checked store URLs
  // pulled from a live page, so they're legitimate catalog data, just from
  // a scrape instead of an affiliate API.
  if (result.status === 'mock' || result.listings.length === 0) return base;

  try {
    base.upserted = await upsertListings(supabaseAdmin, store, result.listings);
  } catch (err) {
    console.error(`[search-products] DB upsert failed for ${store}:`, err);
    base.status = 'error';
    base.message = 'Fetched results but failed to save them to the catalog.';
  }

  return base;
}
