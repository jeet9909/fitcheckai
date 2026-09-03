// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy populate-catalog
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// POPULATE_CATALOG_SECRET (a random server-to-server secret — see
// supabase/README.md for how it was generated/set), plus whichever of
// AMAZON_CREATORS_*/FLIPKART_AFFILIATE_* are configured (see search-
// products/amazonPaapi.ts / flipkartAffiliate.ts) — this function reuses
// those exact same provider adapters.
//
// Deliberately its own separate Edge Function, not a code path inside
// search-products: this exists purely to proactively warm the `products`
// catalog (search-products/localCatalog.ts's cache) across a curated batch
// of (search term, store) pairs, ahead of any real user request, using the
// exact same fetch/scrape/upsert logic search-products/index.ts uses per
// request (orchestrator.ts's runProvider + persistCatalog.ts's
// upsertListings/upsertAndReport — imported directly, not reimplemented).
//
// NO CRON — by design. This is a plain HTTP endpoint the operator invokes
// by hand (or from an external scheduler of their own choosing) with a
// `terms`/`stores` subset, not a Supabase Cron job wired up automatically.
// Reasons: (1) real-API/scrape calls to 6 different stores are exactly the
// kind of "repeated, automated-looking traffic" the scraping fallback's
// live-tested findings show gets blocked fastest (see search-products/
// scraping/*SearchScraper.ts headers) — an unattended cron re-running this
// on a fixed schedule would make that materially worse with no human
// noticing; (2) Amazon/Flipkart's real affiliate APIs have their own rate
// limits this shouldn't blindly hammer; (3) an Edge Function has a wall-
// clock limit, so a single invocation intentionally processes only a
// bounded number of (term, store) pairs (see MAX_PAIRS_PER_INVOCATION
// below) — the caller is expected to invoke this multiple times with
// different `terms` slices for full coverage, a decision that should stay
// a deliberate, observable action, not a silent background job.
//
// Security: POST-only, and requires a matching `x-populate-secret` request
// header — see requireValidSecret below. 401 (with no detail about what the
// correct secret is, and the header's raw value is never logged) if
// missing/wrong. This is a server-to-server admin operation, never called
// from the frontend — there is no client-side code that knows this secret.
//
// Request body: { terms?: string[]; stores?: Store[] }
//   - `terms` defaults to the first `DEFAULT_TERM_COUNT` entries of
//     searchTerms.ts's curated SEARCH_TERMS list when omitted.
//   - `stores` defaults to all 6 stores when omitted.
//   - `terms.length * stores.length` (the number of (term, store) pairs to
//     process) is capped at MAX_PAIRS_PER_INVOCATION — a request exceeding
//     that is a 400, not silently truncated, so the caller knows to split
//     it into multiple calls rather than assuming full coverage happened.
//
// Response: 200 with a JSON summary of every (term, store) pair's real
// outcome (status/count/upserted/message, exactly what search-products
// would report for that pair) plus totals. There is a short delay between
// pairs (politeness / spreading out request volume, not a hard
// anti-detection guarantee — see the file-level comment above).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PROVIDERS, runProvider, type Store } from '../search-products/orchestrator.ts';
import { upsertAndReport, type ProviderResponse } from '../search-products/persistCatalog.ts';
import { DEFAULT_TERM_COUNT, SEARCH_TERMS } from './searchTerms.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-populate-secret',
};

const ALL_STORES = Object.keys(PROVIDERS) as Store[];
const MAX_TERM_LENGTH = 200;
const MAX_TERMS_PER_REQUEST = 20;
// Hard ceiling on (term x store) pairs processed in one invocation. Chosen
// conservatively against the scraper's own 15s-per-request timeout
// (search-products/scraping/htmlUtils.ts) plus the politeness delay below —
// a worst case of every pair hitting its full timeout should still land
// comfortably inside a typical Edge Function wall-clock budget. See the
// file header comment for why this is a hard 400, not a silent truncation.
const MAX_PAIRS_PER_INVOCATION = 24;
// Politeness delay between pairs — deliberately sequential, not concurrent,
// so this doesn't fire a burst of simultaneous requests at any one store.
// Not a hard anti-detection guarantee (see file header comment); just
// spreads load out rather than firing everything at once.
const DELAY_BETWEEN_PAIRS_MS = 350;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Constant-time-ish string comparison for the shared secret — avoids a
// short-circuiting `===` from leaking (via response-time differences) how
// many leading characters of a guessed secret were correct. Not a
// replacement for a real HMAC-based scheme, but a reasonable, dependency-
// free improvement over a naive `===` for a header this function checks on
// every request.
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
  const expected = Deno.env.get('POPULATE_CATALOG_SECRET') ?? '';
  const provided = req.headers.get('x-populate-secret') ?? '';
  // An unset server-side secret must never be treated as "no secret
  // required" — an empty `expected` can only ever match an empty
  // `provided`, and an empty header is already excluded by requiring both
  // to be non-empty first.
  if (!expected || !provided) return false;
  return secretsMatch(provided, expected);
}

interface PairResult extends ProviderResponse {
  term: string;
  store: Store;
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

  const { terms: rawTerms, stores: rawStores } = (body ?? {}) as { terms?: unknown; stores?: unknown };

  let terms: string[];
  if (rawTerms === undefined) {
    terms = SEARCH_TERMS.slice(0, DEFAULT_TERM_COUNT);
  } else {
    if (!Array.isArray(rawTerms) || rawTerms.some((t) => typeof t !== 'string')) {
      return json({ error: '`terms` must be an array of strings.' }, 400);
    }
    terms = (rawTerms as string[]).map((t) => t.trim()).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return json({ error: '`terms` must contain at least one non-empty string.' }, 400);
    }
    if (terms.length > MAX_TERMS_PER_REQUEST) {
      return json({ error: `Too many terms — max ${MAX_TERMS_PER_REQUEST} per request. Split into multiple calls.` }, 400);
    }
    const tooLong = terms.find((t) => t.length > MAX_TERM_LENGTH);
    if (tooLong) {
      return json({ error: `Term too long — max ${MAX_TERM_LENGTH} characters.` }, 400);
    }
  }

  let stores: Store[];
  if (rawStores === undefined) {
    stores = ALL_STORES;
  } else {
    if (!Array.isArray(rawStores) || rawStores.length === 0) {
      return json({ error: '`stores` must be a non-empty array.' }, 400);
    }
    const invalid = (rawStores as unknown[]).filter((s) => typeof s !== 'string' || !ALL_STORES.includes(s as Store));
    if (invalid.length > 0) {
      return json({ error: `Unknown store(s): ${invalid.join(', ')}. Supported: ${ALL_STORES.join(', ')}.` }, 400);
    }
    stores = rawStores as Store[];
  }

  const pairCount = terms.length * stores.length;
  if (pairCount > MAX_PAIRS_PER_INVOCATION) {
    return json(
      {
        error: `${pairCount} (term, store) pairs requested — max ${MAX_PAIRS_PER_INVOCATION} per invocation. Split into multiple calls with a smaller \`terms\`/\`stores\` subset.`,
      },
      400,
    );
  }

  const pairResults: PairResult[] = [];

  try {
    let isFirstPair = true;
    for (const term of terms) {
      for (const store of stores) {
        if (!isFirstPair) await delay(DELAY_BETWEEN_PAIRS_MS);
        isFirstPair = false;

        // Always a real attempt — populate-catalog exists specifically to
        // warm the *real* catalog, so it never honors MOCK_MARKETPLACES
        // (which is a dev/demo-only flag for the interactive search box,
        // see search-products/mockData.ts) even if that happens to be set.
        const result = await runProvider(store, term, false);
        const reported = await upsertAndReport(supabaseAdmin, store, result);
        pairResults.push({ term, store, ...reported });
      }
    }
  } catch (err) {
    // runProvider/upsertAndReport are both documented to never throw — this
    // is defense in depth only, matching search-products/index.ts's own
    // top-level catch. Whatever pairs already completed are still returned
    // (partial progress is more useful than discarding it), plus an error
    // note about the incomplete run.
    console.error('[populate-catalog] unhandled error mid-run:', err);
    return json(
      {
        error: 'Population run failed unexpectedly partway through. Returning partial results.',
        completedPairs: pairResults.length,
        totalPairsRequested: pairCount,
        pairs: pairResults,
      },
      500,
    );
  }

  const totals = {
    pairs: pairResults.length,
    succeeded: pairResults.filter((p) => p.status === 'success').length,
    blocked: pairResults.filter((p) => p.status === 'scrape_blocked' || p.status === 'not_configured').length,
    failed: pairResults.filter((p) => p.status === 'scrape_failed' || p.status === 'error').length,
    totalUpserted: pairResults.reduce((sum, p) => sum + p.upserted, 0),
  };

  return json({ pairs: pairResults, totals });
});
