// Per-provider search orchestration — extracted out of the Deno.serve
// handler so one provider's failure/misconfiguration can never blank out
// another provider's results. `runProvider` is the isolation boundary: it
// never throws, always resolving to a ProviderResult so `Promise.all` in
// `runMarketplaceSearch` can't short-circuit on a single rejected promise.

import { isAmazonConfigured, searchAmazon } from './amazonPaapi.ts';
import { isFlipkartConfigured, searchFlipkart } from './flipkartAffiliate.ts';
import { generateMockListings, isMockMode } from './mockData.ts';
import { isAllowedMarketplaceUrl } from './urlAllowlist.ts';
import type { StoreListing } from './types.ts';

export type Store = 'amazon' | 'flipkart';
export type Marketplace = Store | 'all';

export type ProviderStatus = 'success' | 'not_configured' | 'error' | 'mock';

export interface ProviderResult {
  status: ProviderStatus;
  listings: StoreListing[];
  message?: string;
}

interface ProviderAdapter {
  configured: () => boolean;
  search: (q: string) => Promise<StoreListing[]>;
  label: string;
  // Maps the internal lowercase `store` key to the StoreListing['store']
  // literal each adapter/mock generator uses.
  listingStore: StoreListing['store'];
}

export const PROVIDERS: Record<Store, ProviderAdapter> = {
  amazon: { configured: isAmazonConfigured, search: searchAmazon, label: 'Amazon', listingStore: 'Amazon' },
  flipkart: { configured: isFlipkartConfigured, search: searchFlipkart, label: 'Flipkart', listingStore: 'Flipkart' },
};

const ALL_STORES: Store[] = ['amazon', 'flipkart'];

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
function filterAllowedListings(store: Store, listings: StoreListing[]): StoreListing[] {
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
    return {
      status: 'not_configured',
      listings: [],
      message: `${provider.label} search isn't connected yet.`,
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
