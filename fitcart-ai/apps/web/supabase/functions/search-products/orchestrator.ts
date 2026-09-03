// Per-provider search orchestration — extracted out of the Deno.serve
// handler so one provider's failure/misconfiguration can never blank out
// another provider's results. `runProvider` is the isolation boundary: it
// never throws, always resolving to a ProviderResult so `Promise.all` in
// `runMarketplaceSearch` can't short-circuit on a single rejected promise.

import { isAmazonConfigured, searchAmazon } from './amazonPaapi.ts';
import { isFlipkartConfigured, searchFlipkart } from './flipkartAffiliate.ts';
import { generateMockListings, isMockMode } from './mockData.ts';
import { isAllowedMarketplaceUrl } from './urlAllowlist.ts';
import { scrapeAmazonSearch } from './scraping/amazonSearchScraper.ts';
import { scrapeFlipkartSearch } from './scraping/flipkartSearchScraper.ts';
import { scrapeMeeshoSearch } from './scraping/meeshoSearchScraper.ts';
import { scrapeMyntraSearch } from './scraping/myntraSearchScraper.ts';
import { scrapeAjioSearch } from './scraping/ajioSearchScraper.ts';
import { scrapeNykaaFashionSearch } from './scraping/nykaaFashionSearchScraper.ts';
import type { ScrapeOutcome } from './scraping/types.ts';
import type { StoreListing } from './types.ts';

export type Store = 'amazon' | 'flipkart' | 'meesho' | 'myntra' | 'ajio' | 'nykaaFashion';
export type Marketplace = Store | 'all';

// 'scrape_blocked'/'scrape_failed' are the honest outcomes of the scraping
// fallback (see runProvider below) — used only when the real API isn't
// configured and a live scrape attempt didn't produce usable results. They
// are deliberately distinct from 'not_configured' (which now only means
// "mock is off, not configured, AND we never even got to try scraping" —
// in practice that no longer happens for amazon/flipkart since a scrape is
// always attempted, but the status is kept for type/message-shape
// continuity and in case a future provider has no scraper at all) and from
// 'error' (which is reserved for the real, configured API path failing).
export type ProviderStatus = 'success' | 'not_configured' | 'error' | 'mock' | 'scrape_blocked' | 'scrape_failed';

export interface ProviderResult {
  status: ProviderStatus;
  listings: StoreListing[];
  message?: string;
}

interface ProviderAdapter {
  configured: () => boolean;
  search: (q: string) => Promise<StoreListing[]>;
  // Best-effort search-results-page scrape used only when `configured()` is
  // false and mock mode is off — see runProvider. Never called otherwise.
  scrape: (query: string) => Promise<ScrapeOutcome>;
  label: string;
  // Maps the internal lowercase `store` key to the StoreListing['store']
  // literal each adapter/mock generator uses.
  listingStore: StoreListing['store'];
}

// A search function that's never actually called — used for the 4 stores
// with no public catalog/search API at all (see the four PROVIDERS entries
// below). Throwing here (rather than e.g. returning []) is deliberate: if a
// future code change ever calls provider.search() for one of these stores
// (which would only happen if configured() incorrectly started returning
// true), that's a real bug that should surface loudly in a log/error rather
// than silently behaving as "zero results, all fine".
function searchNotSupported(storeLabel: string): (q: string) => Promise<StoreListing[]> {
  return () => Promise.reject(new Error(`${storeLabel} has no public search API — this code path should never run (configured() is permanently false).`));
}

export const PROVIDERS: Record<Store, ProviderAdapter> = {
  amazon: {
    configured: isAmazonConfigured,
    search: searchAmazon,
    scrape: scrapeAmazonSearch,
    label: 'Amazon',
    listingStore: 'Amazon',
  },
  flipkart: {
    configured: isFlipkartConfigured,
    search: searchFlipkart,
    scrape: scrapeFlipkartSearch,
    label: 'Flipkart',
    listingStore: 'Flipkart',
  },
  // Meesho/Myntra/AJIO/Nykaa Fashion have no public catalog/search API at
  // all (unlike Amazon/Flipkart, which merely aren't configured until real
  // credentials are set) — configured() permanently returns false for these
  // four, so runProvider always takes the scraping-fallback branch. See each
  // scraper file's header comment for what was actually observed live.
  meesho: {
    configured: () => false,
    search: searchNotSupported('Meesho'),
    scrape: scrapeMeeshoSearch,
    label: 'Meesho',
    listingStore: 'Meesho',
  },
  myntra: {
    configured: () => false,
    search: searchNotSupported('Myntra'),
    scrape: scrapeMyntraSearch,
    label: 'Myntra',
    listingStore: 'Myntra',
  },
  ajio: {
    configured: () => false,
    search: searchNotSupported('AJIO'),
    scrape: scrapeAjioSearch,
    label: 'AJIO',
    listingStore: 'AJIO',
  },
  nykaaFashion: {
    configured: () => false,
    search: searchNotSupported('Nykaa Fashion'),
    scrape: scrapeNykaaFashionSearch,
    label: 'Nykaa Fashion',
    listingStore: 'Nykaa Fashion',
  },
};

const ALL_STORES: Store[] = ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'nykaaFashion'];

export function resolveStores(marketplace: Marketplace): Store[] {
  if (marketplace === 'all') return ALL_STORES;
  return [marketplace];
}

// Strip C0/C1 control characters (including CR/LF) before any string is
// interpolated into a log line — defense against log injection via a
// crafted query string.
export function stripControlChars(input: string): string {
  // deno-lint-ignore no-control-regex
  return input.replace(/[\x00-\x1F\x7F]/g, '');
}

// Upper bounds for scraped string fields before they're tagged `source:
// 'scraped'`, allowlist-checked, persisted to the DB, and echoed back in
// the API response. Unlike `query` (a bounded user input already validated
// in index.ts) or the real affiliate-API responses (schema-shaped JSON from
// a trusted, credentialed endpoint), these strings are regex/JSON-LD/state-
// blob extractions from a live third-party HTML page -- a hostile or
// malfunctioning page could serve a pathologically large or control-
// character-laden value for any of them.
const MAX_SCRAPED_FIELD_LENGTH = 300;
const MAX_SCRAPED_URL_LENGTH = 2000;

function sanitizeScrapedString(input: string, maxLength: number): string {
  return stripControlChars(input).slice(0, maxLength);
}

// Applies the same defensive capping/control-char stripping to every string
// field of a scraped listing before it's ever allowlist-checked or
// persisted -- see MAX_SCRAPED_FIELD_LENGTH's comment for why this matters
// specifically for the scraping path (mock and live-API listings don't go
// through this, since mock data is generated in-process and real-API
// listings come from a trusted, schema-shaped response).
// Exported for populate-catalog's browse-node ingestion path (see
// populate-catalog/index.ts) — it needs the exact same defensive
// capping/control-char stripping applied to a scrape outcome that isn't
// query-driven (amazonBrowseNodeScraper.ts), so this is reused rather than
// reimplemented.
export function sanitizeScrapedListing(listing: StoreListing): StoreListing {
  return {
    ...listing,
    name: sanitizeScrapedString(listing.name, MAX_SCRAPED_FIELD_LENGTH),
    brand: sanitizeScrapedString(listing.brand, MAX_SCRAPED_FIELD_LENGTH),
    color: sanitizeScrapedString(listing.color, MAX_SCRAPED_FIELD_LENGTH),
    imageUrl: listing.imageUrl ? sanitizeScrapedString(listing.imageUrl, MAX_SCRAPED_URL_LENGTH) : null,
    productUrl: sanitizeScrapedString(listing.productUrl, MAX_SCRAPED_URL_LENGTH),
  };
}

function sanitizeErrorMessage(_err: unknown): string {
  // Full detail (which may include upstream response bodies or internal
  // stack traces) goes to console.error only — this return value is what's
  // safe to put in the client-facing `message` field. We deliberately don't
  // forward `err.message` verbatim since it could echo a credential or raw
  // upstream error body from amazonPaapi.ts / flipkartAffiliate.ts. `_err`
  // is unused today but kept as a parameter so a future revision can
  // differentiate message text by error type without changing every call
  // site.
  return 'Search request to the upstream provider failed.';
}

// Filters out listings whose productUrl isn't on the store's allowlisted
// domain set, logging what got dropped. Mock listings are exempt — they're
// generated in-process (not from an upstream response) and intentionally
// point at example.com, which would never pass a real marketplace allowlist.
// Exported for the same reason as sanitizeScrapedListing above.
export function filterAllowedListings(store: Store, listings: StoreListing[]): StoreListing[] {
  const listingStore = PROVIDERS[store].listingStore;
  const allowed: StoreListing[] = [];
  for (const listing of listings) {
    if (isAllowedMarketplaceUrl(listingStore, listing.productUrl)) {
      allowed.push(listing);
    } else {
      console.error(`[search-products] dropped ${store} listing with disallowed productUrl domain (omitted from response/DB)`);
    }
  }
  return allowed;
}

// Runs a single provider's search end-to-end, catching everything so a
// throw here can never propagate out of Promise.all and blank out sibling
// providers. `mock` bypasses configured()/search() entirely.
export async function runProvider(store: Store, query: string, mock: boolean): Promise<ProviderResult> {
  const provider = PROVIDERS[store];
  const safeQuery = stripControlChars(query);

  if (mock) {
    console.warn(`[search-products] MOCK_MARKETPLACES is active — returning fake ${provider.label} listings for "${safeQuery}". Never enable this on a production project.`);
    const listings = generateMockListings(provider.listingStore, safeQuery);
    return { status: 'mock', listings };
  }

  if (!provider.configured()) {
    // No approved API credentials — fall back to a best-effort live scrape
    // of the store's own search-results page rather than immediately
    // reporting `not_configured`. This is still an honest outcome either
    // way: a successful scrape is tagged `source: 'scraped'` (never
    // conflated with a real API response's `source: 'live'`), and a
    // blocked/failed scrape says so explicitly rather than silently
    // returning nothing. See scraping/*SearchScraper.ts for what's actually
    // been observed live per store.
    let outcome: ScrapeOutcome;
    try {
      outcome = await provider.scrape(safeQuery);
    } catch (err) {
      // Defense in depth — provider.scrape() is documented to never throw,
      // but runProvider's whole contract is that it itself never throws.
      console.error(`[search-products] ${provider.label} scrape threw unexpectedly for query "${safeQuery}":`, err);
      return {
        status: 'scrape_failed',
        listings: [],
        message: `${provider.label} isn't connected yet, and the scraping fallback failed unexpectedly.`,
      };
    }

    if (outcome.status === 'success' && outcome.listings.length > 0) {
      const scraped = outcome.listings.map((l) => sanitizeScrapedListing({ ...l, source: 'scraped' as const }));
      const allowed = filterAllowedListings(store, scraped);
      if (allowed.length > 0) {
        return { status: 'success', listings: allowed };
      }
      return {
        status: 'scrape_blocked',
        listings: [],
        message: "Scraped results didn't match a trusted store domain.",
      };
    }

    if (outcome.status === 'failed') {
      return {
        status: 'scrape_failed',
        listings: [],
        message: `${provider.label} isn't connected yet, and the scraping fallback failed: ${outcome.reason ?? 'unknown error'}`,
      };
    }

    // outcome.status === 'blocked' (or 'success' with zero listings, which
    // is functionally the same honest "nothing usable" outcome).
    return {
      status: 'scrape_blocked',
      listings: [],
      message: `${provider.label} isn't connected yet, and the scraping fallback was blocked: ${outcome.reason ?? "couldn't parse a real results page"}`,
    };
  }

  try {
    const rawListings = await provider.search(safeQuery);
    const listings = filterAllowedListings(store, rawListings).map((l) => ({ ...l, source: 'live' as const }));
    return { status: 'success', listings };
  } catch (err) {
    console.error(`[search-products] ${provider.label} search failed for query "${safeQuery}":`, err);
    return { status: 'error', listings: [], message: sanitizeErrorMessage(err) };
  }
}

export interface MarketplaceSearchResult {
  results: StoreListing[];
  providers: Record<Store, ProviderResult>;
}

export async function runMarketplaceSearch(query: string, marketplace: Marketplace): Promise<MarketplaceSearchResult> {
  const stores = resolveStores(marketplace);
  const mock = isMockMode();

  const entries = await Promise.all(
    stores.map(async (store): Promise<[Store, ProviderResult]> => [store, await runProvider(store, query, mock)]),
  );

  const providers = Object.fromEntries(entries) as Record<Store, ProviderResult>;
  const results = entries.flatMap(([, result]) => result.listings);

  return { results, providers };
}
