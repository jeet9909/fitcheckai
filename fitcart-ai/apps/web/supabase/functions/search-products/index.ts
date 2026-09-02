// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy search-products
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// plus per-store credentials — see amazonPaapi.ts / flipkartAffiliate.ts —
// and optionally MOCK_MARKETPLACES for dev/demo mock mode (see mockData.ts).
//
// Real multi-item catalog search across Amazon and Flipkart via their
// official affiliate/product APIs — this is what replaced the hardcoded
// demo product list on Discover. Deliberately does NOT fall back to mock/
// placeholder results when a store's credentials aren't set (unless
// MOCK_MARKETPLACES is explicitly on): the entire point of this function is
// that the catalog only ever holds real listings, so an unconfigured store
// returns an honest "not configured" response instead. Myntra/AJIO/Meesho/
// Nykaa Fashion have no public catalog API — those stay on fetch-product's
// single-URL paste flow.
//
// Request contract:  { query: string, marketplace?: 'amazon' | 'flipkart' | 'all' }
//   - `marketplace` defaults to 'all' when omitted.
//   - 400 only for malformed input (missing/empty query, query over 200
//     chars, or an unrecognized marketplace value).
//   - Otherwise always 200 — per-provider outcomes (including "not
//     configured" or an upstream failure) live inside `providers`, not the
//     HTTP status, so one provider's trouble never masks the other's
//     results.
//   - 500 only for a genuine unhandled error, with a sanitized message —
//     full detail (which may include upstream error bodies) goes to
//     console.error server-side only, never to the client.
//
// Response contract:
//   {
//     query: string,
//     mock: boolean,
//     results: StoreListing[],           // merged across providers
//     providers: {
//       amazon:   { status, count, upserted, message? },
//       flipkart: { status, count, upserted, message? },
//     },
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isMockMode } from './mockData.ts';
import { runMarketplaceSearch, stripControlChars, type Marketplace, type ProviderResult, type Store } from './orchestrator.ts';
import type { StoreListing } from './types.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_QUERY_LENGTH = 200;
const VALID_MARKETPLACES: Marketplace[] = ['amazon', 'flipkart', 'all'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Upserts one provider's listings only — a failure here downgrades that
// provider's own status to 'error' (handled by the caller) without ever
// touching, or being able to lose, another provider's already-fetched rows.
async function upsertListings(store: Store, listings: StoreListing[]): Promise<number> {
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

interface ProviderResponse {
  status: ProviderResult['status'];
  count: number;
  upserted: number;
  message?: string;
}

async function upsertAndReport(store: Store, result: ProviderResult): Promise<ProviderResponse> {
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
    base.upserted = await upsertListings(store, result.listings);
  } catch (err) {
    console.error(`[search-products] DB upsert failed for ${store}:`, err);
    base.status = 'error';
    base.message = 'Fetched results but failed to save them to the catalog.';
  }

  return base;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const { query, marketplace: rawMarketplace } = (body ?? {}) as { query?: unknown; marketplace?: unknown };

  if (typeof query !== 'string' || query.trim().length === 0) {
    return json({ error: 'Missing or empty query.' }, 400);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return json({ error: `Query too long — max ${MAX_QUERY_LENGTH} characters.` }, 400);
  }

  // marketplace defaults to 'all' when omitted; an explicit-but-unrecognized
  // value is a 400, not a silent fallback.
  const marketplace = (rawMarketplace ?? 'all') as Marketplace;
  if (typeof marketplace !== 'string' || !VALID_MARKETPLACES.includes(marketplace)) {
    return json({ error: `Unknown marketplace: ${String(rawMarketplace)}. Supported: amazon, flipkart, all.` }, 400);
  }

  // Strip control characters up front — this is the value used for the
  // actual provider search calls, any logging, and the echoed `query` field
  // in the response, so a log-injection payload never reaches a log line.
  const safeQuery = stripControlChars(query.trim());

  try {
    const { results, providers } = await runMarketplaceSearch(safeQuery, marketplace);

    const stores = Object.keys(providers) as Store[];
    const providerEntries = await Promise.all(
      stores.map(async (store): Promise<[Store, ProviderResponse]> => [store, await upsertAndReport(store, providers[store])]),
    );
    const providerResponses = Object.fromEntries(providerEntries) as Record<Store, ProviderResponse>;

    return json({
      query: safeQuery,
      mock: isMockMode(),
      results,
      providers: providerResponses,
    });
  } catch (err) {
    console.error(`[search-products] unhandled error for query "${safeQuery}":`, err);
    return json({ error: 'Search failed unexpectedly. Please try again.' }, 500);
  }
});
