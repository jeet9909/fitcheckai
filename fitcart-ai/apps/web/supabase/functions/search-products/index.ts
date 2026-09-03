// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy search-products
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// plus per-store credentials — see amazonPaapi.ts / flipkartAffiliate.ts —
// and optionally MOCK_MARKETPLACES for dev/demo mock mode (see mockData.ts).
//
// Real multi-item catalog search across all 6 target stores — Amazon,
// Flipkart, Meesho, Myntra, AJIO, and Nykaa Fashion — this is what replaced
// the hardcoded demo product list on Discover. Deliberately does NOT fall
// back to placeholder results (unless MOCK_MARKETPLACES is explicitly on):
// the entire point of this function is that the catalog only ever holds
// real listings.
//
// As of this revision, every requested store goes through 3 layers, tried
// in order, before an honest "nothing found" response:
//   1. **Local cache** (localCatalog.ts) — the `products` table already has
//      real rows for this (store, query) from a previous search or from
//      fetch-product's single-URL paste flow. If there are at least
//      `MIN_CACHE_RESULTS` real (non-mock) matches, they're used directly
//      and neither a real API nor a live scrape is attempted for that store
//      at all this request.
//   2. **Real affiliate API** (amazonPaapi.ts / flipkartAffiliate.ts) — only
//      for Amazon/Flipkart, only when credentials are configured.
//   3. **Best-effort live scrape** (scraping/*SearchScraper.ts) — the
//      fallback used when a store's real API isn't configured (true for
//      Amazon/Flipkart until credentials are set, and *permanently* true
//      for Meesho/Myntra/AJIO/Nykaa Fashion, which have no public catalog/
//      search API at all — see orchestrator.ts's PROVIDERS table and each
//      scraper's header comment for what's actually been observed live).
// A store with *some* but fewer than `MIN_CACHE_RESULTS` cache hits still
// keeps those hits — they're merged (deduped by productUrl) with whatever
// layer 2/3 returns, rather than being discarded. See `populate-catalog`
// (a separate Edge Function) for proactively warming this cache across a
// curated list of search terms/stores ahead of any real user request.
//
// Request contract:  { query: string, marketplace?: <store> | 'all' }
//   `<store>` is one of: amazon, flipkart, meesho, myntra, ajio,
//   nykaaFashion. `marketplace` defaults to 'all' when omitted.
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
//       amazon:       { status, count, upserted, message? },
//       flipkart:     { status, count, upserted, message? },
//       meesho:       { status, count, upserted, message? },
//       myntra:       { status, count, upserted, message? },
//       ajio:         { status, count, upserted, message? },
//       nykaaFashion: { status, count, upserted, message? },
//     },
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveStoreWithCache, type StoreSearchResult } from './cacheFirstSearch.ts';
import { isMockMode } from './mockData.ts';
import { resolveStores, stripControlChars, type Marketplace, type Store } from './orchestrator.ts';
import type { ProviderResponse } from './persistCatalog.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_QUERY_LENGTH = 200;
const VALID_MARKETPLACES: Marketplace[] = ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'nykaaFashion', 'all'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
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
    return json({ error: `Unknown marketplace: ${String(rawMarketplace)}. Supported: amazon, flipkart, meesho, myntra, ajio, nykaaFashion, all.` }, 400);
  }

  // Strip control characters up front — this is the value used for the
  // actual provider search calls, any logging, and the echoed `query` field
  // in the response, so a log-injection payload never reaches a log line.
  const safeQuery = stripControlChars(query.trim());

  try {
    const stores = resolveStores(marketplace);
    const mock = isMockMode();

    const entries = await Promise.all(
      stores.map(async (store): Promise<[Store, StoreSearchResult]> => [
        store,
        await resolveStoreWithCache(supabaseAdmin, store, safeQuery, mock),
      ]),
    );

    const results = entries.flatMap(([, { listings }]) => listings);
    const providers = Object.fromEntries(entries.map(([store, { response }]) => [store, response])) as Record<Store, ProviderResponse>;

    return json({
      query: safeQuery,
      mock,
      results,
      providers,
    });
  } catch (err) {
    console.error(`[search-products] unhandled error for query "${safeQuery}":`, err);
    return json({ error: 'Search failed unexpectedly. Please try again.' }, 500);
  }
});
