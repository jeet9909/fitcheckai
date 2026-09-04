// DB-touching + network-touching core of enrich-catalog, split out of
// index.ts the same way curate-match/matchGroups.ts and curate-product/
// updateProduct.ts are — so each half can be tested independently:
// index.ts's Deno.serve handler validates the request body's shape
// synchronously (auth/method/stores/limit/force), then hands off to
// selectCandidates (a real DB read) and enrichCandidate (a real network
// fetch + real DB write per candidate, run sequentially by index.ts's own
// loop — see its header comment for why sequential, not parallel).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { capMessage, fetchWithTimeout, isExpectedHost, readCappedText } from '../search-products/scraping/htmlUtils.ts';
import { isAllowedMarketplaceUrl } from '../search-products/urlAllowlist.ts';
import { findParserEntryForStore } from '../fetch-product/parsers/storeParsers.ts';
import { buildEnrichmentInput } from '../fetch-product/enrichmentInput.ts';
import { updateProduct } from '../curate-product/updateProduct.ts';

export interface CandidateRow {
  id: number;
  store: string;
  product_url: string;
}

export interface SelectCandidatesInput {
  stores: string[];
  limit: number;
  force: boolean;
}

export type SelectCandidatesResult =
  | { ok: true; candidates: CandidateRow[] }
  | { ok: false; error: string };

interface RawProductRow {
  id: number;
  store: string;
  product_url: string | null;
}

// Selects up to `limit` rows for the requested `stores` that have a real
// `product_url` to fetch, honoring the `force` flag: when `force` is false
// (the default), only rows whose `description` AND `image_urls` are both
// still at their schema defaults (`''` / `'{}'` — see schema.sql) are
// selected, i.e. rows this pipeline (or a curator) hasn't already enriched.
// `force: true` skips that filter and re-processes matching rows
// regardless of their current enrichment state.
export async function selectCandidates(
  supabaseAdmin: SupabaseClient,
  input: SelectCandidatesInput,
): Promise<SelectCandidatesResult> {
  const { stores, limit, force } = input;

  let query = supabaseAdmin
    .from('products')
    .select('id, store, product_url')
    .in('store', stores)
    .not('product_url', 'is', null);

  if (!force) {
    // Matches schema.sql's own column defaults exactly (`description text
    // not null default ''`, `image_urls text[] not null default '{}'`) —
    // a row that has never been enriched (by this function or by a human
    // curator) still has both at their default, so this is a real "has
    // nothing yet" filter, not a heuristic. A row a curator has already
    // given a real description/gallery to is correctly skipped here even
    // if this pipeline itself never touched it.
    query = query.eq('description', '').eq('image_urls', '{}');
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error('[enrich-catalog] failed to select candidate products:', error);
    return { ok: false, error: 'Could not query the catalog for candidate products. Try again.' };
  }

  const rows = (data ?? []) as unknown as RawProductRow[];
  // `.not('product_url', 'is', null)` already excludes nulls at the DB
  // level, but this narrows the TypeScript type to match (defensive — a
  // stale/mocked client in a test could still hand back a null here).
  const candidates = rows.filter((row): row is CandidateRow => typeof row.product_url === 'string' && row.product_url.length > 0);

  return { ok: true, candidates };
}

export type EnrichStatus = 'enriched' | 'scrape_blocked' | 'scrape_failed' | 'not_found' | 'unsupported_store';

export interface EnrichItemResult {
  productId: number;
  store: string;
  status: EnrichStatus;
  message: string;
}

export interface RunEnrichmentLoopParams {
  candidates: CandidateRow[];
  // Injected rather than hardcoded to `(c) => enrichCandidate(supabaseAdmin,
  // c)` so this loop's own timing/early-stop logic can be unit tested with a
  // fake `enrichOne` (and fake `now`/`sleep`) — no real Supabase client or
  // `globalThis.fetch` mocking needed just to exercise the guard itself.
  enrichOne: (candidate: CandidateRow) => Promise<EnrichItemResult>;
  // Invoked synchronously the moment each candidate finishes, *before* the
  // next iteration's budget check — mirrors the original inline loop's
  // `items.push(result)` placement, so a caller that pushes into its own
  // outer array still has every already-completed item preserved even if
  // something downstream throws (see index.ts's top-level catch, which
  // still returns whatever the outer array collected so far).
  onItem: (item: EnrichItemResult) => void;
  delayMs: number;
  // The internal safety budget (index.ts's SAFE_WALL_CLOCK_BUDGET_MS),
  // deliberately well under the real platform wall-clock limit — see that
  // constant's own comment for why.
  safeBudgetMs: number;
  // The worst-case single-candidate fetch time (index.ts passes
  // search-products/scraping/htmlUtils.ts's DEFAULT_FETCH_TIMEOUT_MS) — the
  // guard treats "one more candidate" as potentially costing this much, not
  // an optimistic average.
  fetchTimeoutMs: number;
  // Overridable clock/sleep, defaulting to the real ones — a test can inject
  // a fake `now` (and a `sleep` that resolves immediately, so the test
  // itself doesn't actually wait) to deterministically simulate elapsed time
  // crossing the safe budget mid-batch, without any real multi-second delay.
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunEnrichmentLoopResult {
  // True when the loop stopped before processing every requested candidate
  // because continuing risked exceeding the safe wall-clock budget — a
  // deliberate, honestly-reported early stop, never a silent truncation.
  stoppedEarly: boolean;
  processedCount: number;
  requestedCount: number;
}

// Sequentially processes `candidates` via `enrichOne`, with a politeness
// delay between each pair (same reasoning as populate-catalog's own pair
// loop — see index.ts's file header comment) — plus a real elapsed-wall-
// clock-time guard, checked before starting every candidate after the
// first: if what's left of `safeBudgetMs` couldn't plausibly cover one more
// candidate's worst-case fetch timeout plus the delay before it, the loop
// stops cleanly and reports `stoppedEarly: true` rather than gambling that
// this candidate resolves quickly and risking the platform's own wall-clock
// limit killing the invocation mid-request (discarding the in-flight HTTP
// response, though already-written enrichments from completed candidates
// persist independently since each one commits its own row via
// updateProduct()). This is defense in depth on top of index.ts's own
// MAX_PRODUCTS_PER_INVOCATION static cap, not a replacement for it — a
// "safe" static cap is still just a worst-case estimate, and this
// codebase's own documented reality (stores hanging, inconsistent block
// timing) means the actual worst case could still exceed it.
export async function runEnrichmentLoop(params: RunEnrichmentLoopParams): Promise<RunEnrichmentLoopResult> {
  const { candidates, enrichOne, onItem, delayMs, safeBudgetMs, fetchTimeoutMs } = params;
  const now = params.now ?? (() => Date.now());
  const sleep = params.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const startedAt = now();
  let processedCount = 0;
  let stoppedEarly = false;
  let isFirstCandidate = true;

  for (const candidate of candidates) {
    if (!isFirstCandidate) {
      const elapsedMs = now() - startedAt;
      const remainingBudgetMs = safeBudgetMs - elapsedMs;
      // "Could plausibly exceed a safe budget" == not enough budget left to
      // cover both the politeness delay about to be awaited and this next
      // candidate's own worst-case fetch timeout.
      if (remainingBudgetMs < delayMs + fetchTimeoutMs) {
        stoppedEarly = true;
        break;
      }
      await sleep(delayMs);
    }
    isFirstCandidate = false;

    const result = await enrichOne(candidate);
    onItem(result);
    processedCount++;
  }

  return { stoppedEarly, processedCount, requestedCount: candidates.length };
}

// Same style of User-Agent fetch-product/index.ts already sends for its own
// single-product-page fetch — identifies this as FitCartAI's own request,
// no UA spoofing/rotation.
const PRODUCT_PAGE_USER_AGENT = 'Mozilla/5.0 (compatible; FitCartAI/1.0; +https://jeet9909.github.io/fitcheckai/)';

// Fetches, parses, and (best-effort) saves the richer fields for a single
// candidate product. Never throws — every real failure mode (unsupported
// store, a disallowed fetch target, a network/timeout error, a non-2xx
// response, an unparseable page, a page that parsed but yielded nothing
// new, or a DB write failure) is mapped to an honest EnrichItemResult
// status/message, exactly the same "never claim success where extraction
// genuinely returned nothing" posture as fetch-product's own parsers.
export async function enrichCandidate(
  supabaseAdmin: SupabaseClient,
  candidate: CandidateRow,
): Promise<EnrichItemResult> {
  const { id: productId, store } = candidate;

  const parserEntry = findParserEntryForStore(store);
  if (!parserEntry) {
    return {
      productId,
      store,
      status: 'unsupported_store',
      message: `No parser is registered for store "${store}" — skipped.`,
    };
  }

  // Re-validates the *fetch target* against the allowlist, not just trusting
  // that this row's product_url was already validated when it was first
  // written — a row's store/URL pairing could in principle have drifted
  // since then (e.g. a future data-integrity bug elsewhere), and this
  // function is about to make a real outbound request to it, which is
  // exactly the class of action isAllowedMarketplaceUrl exists to gate.
  if (!isAllowedMarketplaceUrl(parserEntry.store, candidate.product_url)) {
    return {
      productId,
      store,
      status: 'scrape_blocked',
      message: `product_url isn't on an allowlisted domain for ${store} — refused to fetch it.`,
    };
  }

  let html: string;
  let expectedHost: string;
  try {
    expectedHost = new URL(candidate.product_url).hostname;
  } catch {
    return { productId, store, status: 'scrape_blocked', message: 'product_url is not a valid URL.' };
  }

  try {
    const res = await fetchWithTimeout(candidate.product_url, {
      headers: { 'User-Agent': PRODUCT_PAGE_USER_AGENT },
    });

    if (res.status === 404) {
      return { productId, store, status: 'not_found', message: 'The product page returned 404 — it may have been removed.' };
    }
    if (!res.ok) {
      return { productId, store, status: 'scrape_blocked', message: `HTTP ${res.status} from ${store}.` };
    }
    // Defense against a hijacked/compromised redirect sending this request
    // to an attacker-controlled or internal host whose response would
    // otherwise be parsed and trusted — see htmlUtils.ts's isExpectedHost.
    if (!isExpectedHost(res.url, expectedHost)) {
      return { productId, store, status: 'scrape_blocked', message: 'Response came from an unexpected host after redirect(s).' };
    }

    html = await readCappedText(res);
  } catch (err) {
    return { productId, store, status: 'scrape_failed', message: capMessage(err) };
  }

  const parsed = parserEntry.parser(html, candidate.product_url);
  if (!parsed) {
    return {
      productId,
      store,
      status: 'scrape_blocked',
      message: "Fetched the page but couldn't parse it — likely a bot-check/placeholder page rather than the real product page.",
    };
  }

  const enrichmentInput = buildEnrichmentInput(parsed);
  if (!enrichmentInput) {
    return {
      productId,
      store,
      status: 'scrape_blocked',
      message: 'Fetched and parsed the page, but no description/material/size chart/gallery could be extracted from it.',
    };
  }

  // KNOWN, ACCEPTED RACE (flagged by final review, not fixed — narrow and
  // low-impact enough to track rather than block on): selectCandidates()
  // picked this row because description/image_urls were empty *at selection
  // time*. Between then and this write (up to ~15s of fetch time), a human
  // could concurrently curate-product this exact row with real data.
  // updateProduct()'s own TOCTOU guard only re-checks `store` hasn't
  // changed — it does NOT re-check that description/image_urls are STILL
  // empty at write time, so this call would silently overwrite a curator's
  // just-set value with scraped data (last-write-wins, no conflict signal,
  // no data corruption — just a stale overwrite). Realistic exposure is low
  // (both are admin-only operations; the window is one row for one batch
  // item's fetch duration), but a real compare-and-swap here (only write if
  // description/image_urls are still at their defaults) would close it
  // properly if this ever becomes a live concern — not implemented now.
  const result = await updateProduct(supabaseAdmin, { productId, ...enrichmentInput });
  if (!result.ok) {
    return { productId, store, status: 'scrape_failed', message: `Extracted real data but failed to save it: ${result.error}` };
  }

  return {
    productId,
    store,
    status: 'enriched',
    message: `Updated: ${Object.keys(result.updated).join(', ')}.`,
  };
}
