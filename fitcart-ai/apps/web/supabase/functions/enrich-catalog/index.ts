// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy enrich-catalog
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// ENRICH_CATALOG_SECRET (a random server-to-server secret — see
// supabase/README.md for how to generate/set it). Deliberately its own
// secret, not a reuse of POPULATE_CATALOG_SECRET/CURATE_MATCH_SECRET/
// CURATE_PRODUCT_SECRET — same reasoning every other admin function in this
// codebase already gives for not sharing a secret: this is a distinct admin
// capability, and rotating/revoking one must never affect any of the
// others.
//
// Turns the manual, one-product-at-a-time proof this session already ran by
// hand (curl + a browser User-Agent against 7 real Amazon product pages,
// parsed with ad-hoc Node scripts) into a real, repeatable, tested batch
// pipeline: for each already-catalogued product whose `product_url` is
// known, re-fetch that product's own page, parse it with the matching
// fetch-product parser (unmodified — see fetch-product/parsers/
// storeParsers.ts, imported directly, not reimplemented), and write
// whatever richer fields (description/material/sizeChart/imageUrls) it
// found through curate-product's own updateProduct() — the same validated,
// TOCTOU-safe, per-store-allowlist-checked write path human curation uses.
// See candidates.ts for the actual selection/fetch/parse/write logic; this
// file only handles auth + request validation + the per-candidate loop.
//
// Security: POST-only, and requires a matching `x-enrich-catalog-secret`
// request header — see requireValidSecret below. 401 (with no detail about
// what the correct secret is, and the header's raw value is never logged)
// if missing/wrong. This is a server-to-server admin operation, never
// called from the frontend — there is no client-side code that knows this
// secret.
//
// Request body: { stores?: Store[]; limit?: number; force?: boolean }
//   - `stores` defaults to `['Amazon']` ONLY when omitted — explicit opt-in
//     is required to target Myntra/AJIO/Flipkart/Meesho/Nykaa Fashion.
//     Amazon is the only store this session's manual proof was ever
//     actually run against; every other store's product pages have been
//     repeatedly, and separately, documented (see supabase/README.md's
//     "Known limitations" section) as either blocked outright (403s,
//     HTTP/2-level resets) or successfully fetched but unparseable (a
//     bot-check/placeholder page instead of the real product page) — the
//     parsers for those five are included for architecture completeness
//     (Task 3 of this session's work) and DO attempt real extraction, but
//     defaulting a batch job to all six would spend this function's limited
//     per-invocation budget on five near-certain failures by default. Any
//     of the five can still be targeted explicitly via `stores` — this is
//     an opt-in guard, not a hard block.
//   - `limit` caps how many candidate products this invocation processes,
//     defaulting to MAX_PRODUCTS_PER_INVOCATION when omitted. A `limit`
//     above MAX_PRODUCTS_PER_INVOCATION is a hard 400, never silently
//     truncated — same posture populate-catalog's own
//     MAX_PAIRS_PER_INVOCATION check already takes, for the same reason:
//     the caller should know to split into multiple calls, not assume full
//     coverage happened. MAX_PRODUCTS_PER_INVOCATION is deliberately lower
//     than populate-catalog's own MAX_PAIRS_PER_INVOCATION (24) — a full
//     product-page fetch/parse here is heavier than a search-tile fetch
//     there, and this session's own README already documents Amazon's bot
//     detection appearing after only "a few requests" in one prior live
//     test, so a smaller, more conservative per-invocation budget is the
//     honest choice for this specific endpoint.
//   - `force` (default false): when false, only products whose
//     `description` AND `image_urls` are both still at their schema
//     defaults (i.e. never enriched by this pipeline or a human curator)
//     are selected — see candidates.ts's selectCandidates. `true`
//     re-processes matching rows regardless of current enrichment state
//     (e.g. to pick up a parser improvement against already-enriched rows).
//
// Response: 200 with a JSON summary of every candidate's real outcome
// (`{ productId, store, status, message }`, status one of `enriched |
// scrape_blocked | scrape_failed | not_found | unsupported_store`) plus
// `totals` — mirrors populate-catalog's own `{ items, totals }` response
// shape convention. Processing is strictly sequential (never parallel) with
// a politeness delay between candidates, same reasoning populate-catalog's
// own header comment already gives for its own pair loop: this doesn't fire
// a burst of simultaneous requests at any one store, though (as documented
// there and in supabase/README.md) this is not a hard anti-detection
// guarantee — nothing here evades real bot detection. If the processing loop
// stops before reaching every selected candidate because continuing risked
// exceeding the platform's own wall-clock execution limit (see
// SAFE_WALL_CLOCK_BUDGET_MS/runEnrichmentLoop in candidates.ts), the response
// still carries the honest `{ items, totals }` for whatever *did* complete,
// plus a top-level `note` string saying so plainly — never a silent
// truncation, and never treated as an error (it's a planned, graceful stop,
// not a bug).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { STORE_PARSERS } from '../fetch-product/parsers/storeParsers.ts';
import { DEFAULT_FETCH_TIMEOUT_MS } from '../search-products/scraping/htmlUtils.ts';
import { enrichCandidate, runEnrichmentLoop, selectCandidates, type EnrichItemResult } from './candidates.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrich-catalog-secret',
};

const ALL_STORES = STORE_PARSERS.map((entry) => entry.store);
const DEFAULT_STORES = ['Amazon'];

// See the file header comment for why this is materially lower than
// populate-catalog's MAX_PAIRS_PER_INVOCATION (24): a full product-page
// fetch+parse+write is heavier per item, and Amazon's own bot detection has
// been live-observed kicking in after only a handful of requests.
//
// Sized against this Supabase project's confirmed Free-plan Edge Function
// wall-clock limit of 150s (https://supabase.com/docs/guides/functions/
// limits), not an arbitrary round number. Worst case, every candidate hits
// enrichCandidate's fetchWithTimeout's own DEFAULT_FETCH_TIMEOUT_MS (15s,
// search-products/scraping/htmlUtils.ts) instead of returning quickly — this
// codebase's own README already documents stores hanging/blocking rather
// than failing fast, so "every candidate times out" is a realistic worst
// case, not a hypothetical one. With N candidates and the DELAY_BETWEEN_
// PRODUCTS_MS politeness delay between each pair:
//   N x 15s + (N - 1) x 2s <= budget
// N = 15 (the old value) gives 15x15 + 14x2 = 225 + 28 = 253s — already past
// the 150s platform ceiling on its own, before accounting for the function's
// own overhead (cold start, imports, the selectCandidates DB round-trip,
// JSON serialization). N = 6 gives 6x15 + 5x2 = 90 + 10 = 100s — comfortably
// under a 120s internal safety target (see SAFE_WALL_CLOCK_BUDGET_MS below),
// which itself leaves a further 30s of headroom under the real 150s platform
// limit for that non-loop overhead. This static cap alone is still just a
// worst-case estimate, though — see the elapsed-time guard in the
// processing loop below for the actual defense-in-depth mechanism.
const MAX_PRODUCTS_PER_INVOCATION = 6;
// Politeness delay between candidates — deliberately sequential, not
// concurrent (see file header comment). Larger than populate-catalog's own
// 350ms DELAY_BETWEEN_PAIRS_MS, again because a full product-page fetch is
// heavier/more detection-sensitive than a search-tile fetch.
const DELAY_BETWEEN_PRODUCTS_MS = 2000;

// Defense-in-depth internal safety budget for the whole processing loop,
// checked against real elapsed wall-clock time (Date.now()), not just relied
// on as a static estimate the way MAX_PRODUCTS_PER_INVOCATION's own
// arithmetic above is. Deliberately well under the real 150s platform limit
// (see MAX_PRODUCTS_PER_INVOCATION's comment) — a "safe" static cap is still
// only a worst-case estimate, and this codebase's own documented reality
// (stores hanging, inconsistent block timing) means the actual worst case
// could still exceed it. 120s leaves 30s of headroom under the platform's
// real 150s ceiling for the function's own non-loop overhead (cold start,
// imports, the selectCandidates DB round-trip, response serialization).
const SAFE_WALL_CLOCK_BUDGET_MS = 120_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Same constant-time-ish comparison as every other admin Edge Function in
// this codebase (populate-catalog/curate-match/curate-product) — duplicated
// rather than imported since these are independent functions each guarding
// their own independent secret.
function secretsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Never logs the provided or expected secret value — only whether the
// request was authorized.
function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get('ENRICH_CATALOG_SECRET') ?? '';
  const provided = req.headers.get('x-enrich-catalog-secret') ?? '';
  // An unset server-side secret must never be treated as "no secret
  // required" — an empty `expected` can only ever match an empty
  // `provided`, and an empty header is already excluded by requiring both
  // to be non-empty first.
  if (!expected || !provided) return false;
  return secretsMatch(provided, expected);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  if (!isAuthorized(req)) {
    // Deliberately generic — never confirms/denies whether a header was
    // present at all, let alone how close a wrong value was.
    return json({ error: 'Unauthorized.' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const { stores: rawStores, limit: rawLimit, force: rawForce } = (body ?? {}) as {
    stores?: unknown;
    limit?: unknown;
    force?: unknown;
  };

  let stores: string[];
  if (rawStores === undefined) {
    stores = DEFAULT_STORES;
  } else {
    if (!Array.isArray(rawStores) || rawStores.length === 0) {
      return json({ error: '`stores` must be a non-empty array.' }, 400);
    }
    const invalid = (rawStores as unknown[]).filter((s) => typeof s !== 'string' || !ALL_STORES.includes(s as (typeof ALL_STORES)[number]));
    if (invalid.length > 0) {
      return json({ error: `Unknown store(s): ${invalid.join(', ')}. Supported: ${ALL_STORES.join(', ')}.` }, 400);
    }
    stores = [...new Set(rawStores as string[])];
  }

  let limit: number;
  if (rawLimit === undefined) {
    limit = MAX_PRODUCTS_PER_INVOCATION;
  } else {
    if (typeof rawLimit !== 'number' || !Number.isInteger(rawLimit) || rawLimit <= 0) {
      return json({ error: '`limit` must be a positive integer.' }, 400);
    }
    if (rawLimit > MAX_PRODUCTS_PER_INVOCATION) {
      return json(
        { error: `\`limit\` of ${rawLimit} exceeds the max of ${MAX_PRODUCTS_PER_INVOCATION} products per invocation. Split into multiple calls.` },
        400,
      );
    }
    limit = rawLimit;
  }

  let force: boolean;
  if (rawForce === undefined) {
    force = false;
  } else {
    if (typeof rawForce !== 'boolean') {
      return json({ error: '`force` must be a boolean.' }, 400);
    }
    force = rawForce;
  }

  const items: EnrichItemResult[] = [];
  let stoppedEarly = false;
  let requestedCount = 0;

  try {
    const selectResult = await selectCandidates(supabaseAdmin, { stores, limit, force });
    if (!selectResult.ok) {
      return json({ error: selectResult.error }, 500);
    }

    const loopResult = await runEnrichmentLoop({
      candidates: selectResult.candidates,
      enrichOne: (candidate) => enrichCandidate(supabaseAdmin, candidate),
      // Pushes into the outer `items` array as each candidate finishes, not
      // just at the end — so if runEnrichmentLoop itself somehow throws
      // (see the catch below), whatever already completed is still in
      // `items` and gets returned rather than discarded.
      onItem: (item) => items.push(item),
      delayMs: DELAY_BETWEEN_PRODUCTS_MS,
      safeBudgetMs: SAFE_WALL_CLOCK_BUDGET_MS,
      fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    });
    stoppedEarly = loopResult.stoppedEarly;
    requestedCount = loopResult.requestedCount;
  } catch (err) {
    // selectCandidates/enrichCandidate are both documented to never throw —
    // this is defense in depth only, matching populate-catalog's own
    // top-level catch. Whatever items already completed are still returned
    // (partial progress is more useful than discarding it).
    console.error('[enrich-catalog] unhandled error mid-run:', err);
    return json(
      {
        error: 'Enrichment run failed unexpectedly partway through. Returning partial results.',
        items,
      },
      500,
    );
  }

  const totals = {
    candidates: items.length,
    enriched: items.filter((i) => i.status === 'enriched').length,
    scrapeBlocked: items.filter((i) => i.status === 'scrape_blocked').length,
    scrapeFailed: items.filter((i) => i.status === 'scrape_failed').length,
    notFound: items.filter((i) => i.status === 'not_found').length,
    unsupportedStore: items.filter((i) => i.status === 'unsupported_store').length,
  };

  const response: { items: EnrichItemResult[]; totals: typeof totals; note?: string } = { items, totals };
  if (stoppedEarly) {
    // Honest, not a bug and not a silent truncation — see
    // SAFE_WALL_CLOCK_BUDGET_MS's comment and runEnrichmentLoop's own
    // header comment above for why this can happen even though `items`
    // never exceeds MAX_PRODUCTS_PER_INVOCATION's own static cap. Every
    // item in `items` still completed and was saved normally; only
    // candidates beyond that point were never attempted this invocation.
    response.note =
      `Stopped early to stay within the platform's execution limit — processed ${items.length} of ` +
      `${requestedCount} requested candidate(s). Re-invoke to process the rest (already-enriched rows won't ` +
      "be re-selected unless `force: true` is passed).";
  }

  return json(response);
});
