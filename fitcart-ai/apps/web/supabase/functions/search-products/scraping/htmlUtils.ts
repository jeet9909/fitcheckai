// Small string helpers shared by the two search-results scrapers
// (amazonSearchScraper.ts / flipkartSearchScraper.ts). Kept local to this
// `scraping/` directory rather than promoted to `_shared/` since nothing
// outside it needs them.

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  reg: '®',
  trade: '™',
  deg: '°',
};

// Decodes the set of HTML entities that show up in real marketplace markup
// this codebase parses — originally just Amazon/Flipkart search-result
// tiles (apostrophes and ampersands in short titles), but textFromHtml
// (which calls this) is now also used by fetch-product/parsers/amazon.ts to
// pull real product-description/material prose out of Amazon product pages
// — longer marketing copy that routinely uses em/en dashes, ellipses, curly
// quotes, and ®/™/° marks that a short search-tile title rarely does, hence
// the larger table below. Still not a full HTML-entity table — deliberately
// scoped to what's actually been observed in real marketplace markup rather
// than pulling in an HTML-entities dependency.
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (Number.isNaN(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Strips HTML tags then decodes entities — used on inner markup pulled out
// of a search-result tile (e.g. an `<h2><span>Title</span></h2>` block).
export function textFromHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim();
}

// Parses an Indian-formatted currency string ("₹3,389", "Rs. 1,999.00",
// "INR 449") into a whole-number price. Returns null (never NaN, never a
// fabricated 0) when nothing numeric is found, so callers can treat
// "couldn't find a real price" as an explicit signal to drop the item
// rather than silently writing a 0 price into the catalog.
//
// Currency symbols/abbreviations (₹, "Rs.", "Rs", "INR") are stripped
// *before* the general non-numeric sanitizer runs — doing it the other way
// around (as this function originally did) leaves the period from "Rs."
// sitting right next to the number's own decimal point, e.g. "Rs. 1,999.00"
// -> ".1999.00", which `Number()` can't parse and this returned null for
// (confirmed: that was literally this function's own documented example).
//
// The result is always rounded to the nearest integer via `Math.round()` —
// matching the exact convention amazonPaapi.ts / flipkartAffiliate.ts
// already apply to their real-API prices — since `products.price`/
// `products.mrp` are `integer not null` columns (see schema.sql) and
// `upsertListings` sends every listing for a store in one `.upsert()` call;
// a single fractional price (e.g. "₹599.50") would otherwise fail Postgres's
// insert for the *entire* batch, not just that one row.
export function parseIndianPrice(text: string): number | null {
  const withoutCurrencyMarkers = text.replace(/₹|Rs\.?|INR/gi, '');
  const cleaned = withoutCurrencyMarkers.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value) : null;
}

// Default network timeout for the two search-results scrapers. Confirmed
// necessary live 2026-09-02: a request to Flipkart's search page from the
// deployed Edge Function's network occasionally hung well past 90s with no
// response (consistent with an anti-bot tactic of accepting the TCP
// connection and then never sending data, rather than an outright
// rejection) — without a bound here, that would hang the whole
// runMarketplaceSearch() call (and, via the platform's own function-level
// timeout, potentially the whole request) instead of cleanly resolving to
// an honest 'failed' outcome.
//
// Exported (not just module-local) because enrich-catalog/index.ts's own
// per-invocation wall-clock budget arithmetic and elapsed-time guard need
// this exact value too, for its own fetchWithTimeout call against product
// pages — importing it keeps both call sites' timeout assumptions from
// silently drifting apart.
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

// Wraps `fetch` with an AbortController-based timeout. Rejects with an
// Error (never resolves indefinitely) if the timeout elapses first — the
// caller's existing try/catch around the fetch call turns that into a
// ScrapeOutcome of status 'failed', same as any other thrown network error.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Caps an error's message to a bounded length before it's ever put in a
// ScrapeOutcome.reason (which, unlike the sanitized provider-error message
// path in orchestrator.ts, IS surfaced to the client for scrape failures —
// see the 'scrape_failed' handling there). Mirrors the same defensive
// capping amazonPaapi.ts / flipkartAffiliate.ts already do for upstream
// response bodies in thrown errors, so one giant/malformed page or error
// object can never blow up a log line or response payload.
export function capMessage(input: unknown, maxLength = 200): string {
  const text = input instanceof Error ? input.message : String(input);
  return text.slice(0, maxLength);
}

// Upper bound on how much of a scraped response body we'll ever buffer into
// memory. A real Amazon/Flipkart search-results page is a few hundred KB —
// this is a generous ceiling that exists purely to defend against a
// hostile or malfunctioning third-party response (or a compromised
// CDN/edge in front of the real site) streaming an effectively unbounded
// body at an Edge Function isolate, which would otherwise buffer the whole
// thing via a bare `res.text()` before any size check ever ran.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MiB

// Reads a Response body as text, aborting (by cancelling the underlying
// stream and throwing) once more than `maxBytes` have been read — used in
// place of a bare `res.text()` for the two search-results scrapers, whose
// caller already wraps this in a try/catch that turns the throw into an
// honest ScrapeOutcome of status 'failed'. Falls back to `res.text()` when
// a body stream isn't available (e.g. a manually-constructed `Response` in
// a unit test), since there's nothing to bound-check incrementally there.
export async function readCappedText(res: Response, maxBytes: number = MAX_RESPONSE_BYTES): Promise<string> {
  if (!res.body) return res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('response exceeded size cap').catch(() => {});
        throw new Error(`Response body exceeded ${maxBytes}-byte cap`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(combined);
}

// True if `url`'s hostname is exactly `expectedHost` or a subdomain of it.
// Used to verify the *final* response URL (after `fetch` has followed any
// redirects) is still on the marketplace host we intended to hit — defense
// against a hijacked/compromised redirect on the real site silently
// sending this scraper's request to an attacker-controlled or internal
// host, whose response body would otherwise be parsed and trusted exactly
// like a real Amazon/Flipkart page. `url` may be an empty string (a
// manually-constructed `Response` in a unit test never has one set), in
// which case there is nothing to check and the caller should treat that as
// "no redirect info available" rather than a failure.
export function isExpectedHost(url: string, expectedHost: string): boolean {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const suffix = expectedHost.toLowerCase();
    return host === suffix || host.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

// Amazon's search-result tile markup embeds a small thumbnail (observed
// live: `..._AC_UL320_.jpg`, ~7KB) even though the exact same image is
// available at full product-page resolution on the identical CDN path —
// only the size token between the image id and the file extension differs.
// Confirmed live 2026-09-04: swapping that token for `_AC_SL1500_` on a real
// captured URL returns a real 200 at ~5-20x the byte size, same image.
// Every URL this scraper (and amazonSearchScraper.ts's JSON-LD path) stores
// should go through this before being persisted — nothing here re-fetches
// or re-scrapes anything, it's a pure string transform on data already in
// hand. Not applied to amazonBrowseNodeScraper.ts's images, which already
// select the deals widget's own `hiRes` variant (a real large image with
// explicit width/height in the source payload, not a thumbnail token).
//
// Handles both a single size token (`._AC_UL320_.jpg`) and a compound one
// (`._AC_UL225_SR225,160_.jpg`, observed on the browse-node deals widget's
// tile markup) by replacing everything between the image id and the file
// extension, rather than trying to pattern-match every token Amazon uses.
const AMAZON_IMAGE_SIZE_TOKEN_RE = /(\/images\/I\/[^./]+)\.[^/]*\.(jpg|jpeg|png|webp)(\?.*)?$/i;

export function upsizeAmazonImageUrl(url: string): string {
  return url.replace(AMAZON_IMAGE_SIZE_TOKEN_RE, '$1._AC_SL1500_.$2$3');
}
