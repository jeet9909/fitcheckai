import type { Product } from '../data/products';
import { supabase, isSupabaseConfigured } from './supabase';

const BASE = '/api';

interface ProductRow {
  id: number;
  name: string;
  brand: string;
  store: string;
  category: string;
  bucket: string;
  slot: string;
  price: number;
  mrp: number;
  color: string;
  material: string;
  description: string | null;
  fit_score: number;
  confidence: number;
  breakdown: unknown;
  source: string;
  product_url: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  size_chart: unknown;
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    store: row.store,
    category: row.category,
    bucket: row.bucket,
    slot: row.slot as Product['slot'],
    price: row.price,
    mrp: row.mrp,
    color: row.color,
    material: row.material,
    description: row.description ?? '',
    fitScore: row.fit_score,
    confidence: row.confidence,
    breakdown: (row.breakdown ?? []) as Product['breakdown'],
    source: row.source,
    productUrl: row.product_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageUrls: row.image_urls ?? [],
    sizeChart: row.size_chart ?? undefined,
  };
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ApiState {
  savedProductIds: number[];
  consent: { photos: boolean; sharing: boolean };
  profileSetupDone: boolean;
  error?: string;
}

export async function fetchProducts(): Promise<Product[]> {
  // Real catalog when Supabase is configured (populated by the
  // fetch-product Edge Function / curated rows); falls back to the mock
  // backend's /api/products otherwise so the GH Pages build keeps working.
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('products').select('*').order('id');
    if (!error && data) return (data as ProductRow[]).map(rowToProduct);
  }
  return req('/products');
}

// `product_match_groups` / `product_match_members` — manually-curated groups
// of "this is the same product on another store", added by a backend task
// running in parallel (public-read RLS, so a plain client query works with
// the anon key, same as fetchProducts()). Curation is expected to be sparse
// for a long time, so "this product isn't in any group" is the common case
// and must resolve fast and quietly — never as an error — rather than
// forcing every ProductDetail load to wait on/report a failed lookup.
interface MatchMemberRow {
  match_group_id: number;
}

export async function fetchMatchGroup(productId: number): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data: membership, error: membershipError } = await supabase
    .from('product_match_members')
    .select('match_group_id')
    .eq('product_id', productId)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return [];

  const { data: members, error: membersError } = await supabase
    .from('product_match_members')
    .select('product_id')
    .eq('match_group_id', (membership as MatchMemberRow).match_group_id)
    .neq('product_id', productId);
  if (membersError || !members || members.length === 0) return [];

  const otherIds = (members as { product_id: number }[]).map((m) => m.product_id);
  const { data: rows, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', otherIds);
  if (productsError || !rows) return [];

  return (rows as ProductRow[]).map(rowToProduct);
}

export function fetchState(): Promise<ApiState> {
  return req('/state');
}

export function toggleSavedApi(productId: number): Promise<ApiState> {
  return req('/saved/toggle', { method: 'POST', body: JSON.stringify({ productId }) });
}

export function toggleConsentApi(key: 'photos' | 'sharing'): Promise<ApiState> {
  return req('/consent', { method: 'POST', body: JSON.stringify({ key }) });
}

export function setupProfileApi(): Promise<ApiState> {
  return req('/profile/setup', { method: 'POST' });
}

export function deleteProfileApi(): Promise<ApiState> {
  return req('/profile', { method: 'DELETE' });
}

// The full set of stores the backend's orchestrator can resolve a single
// store name to — keep this in sync with the backend's own store list
// (supabase/functions/search-products/orchestrator.ts).
export const STORE_KEYS = ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'nykaaFashion'] as const;
export type StoreKey = typeof STORE_KEYS[number];

export type Marketplace = StoreKey | 'all';

export interface StoreListing {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  productUrl: string;
  store: 'Amazon' | 'Flipkart' | 'Meesho' | 'Myntra' | 'AJIO' | 'Nykaa Fashion';
  source?: 'live' | 'mock' | 'scraped';
}

export type ProviderStatus = 'success' | 'not_configured' | 'error' | 'mock' | 'scrape_blocked' | 'scrape_failed';

export interface ProviderResult {
  status: ProviderStatus;
  count: number;
  upserted: number;
  message?: string;
}

export interface MarketplaceSearchResult {
  query: string;
  mock: boolean;
  results: StoreListing[];
  providers: Partial<Record<StoreKey, ProviderResult>>;
}

// The backend's own resolveStores() (orchestrator.ts) maps a single-store
// `marketplace` request to just that one store, and index.ts builds
// `providers` from `Object.keys(providers)` of whatever resolveStores()
// returned — so a request for 'amazon' gets back a response whose
// `providers` object has ONLY an `amazon` key, never fabricated entries for
// the other five stores. Client-side fallback/error responses (built below,
// for cases where we never actually reach the backend, or it returns a
// malformed body) must mirror that same shape — otherwise a single-store
// caller (StoreSearch.tsx) would see a phantom status for a provider it
// never asked about.
function resolveRequestedStores(marketplace: Marketplace): StoreKey[] {
  return marketplace === 'all' ? [...STORE_KEYS] : [marketplace];
}

function buildFallbackProviders(
  marketplace: Marketplace,
  result: ProviderResult,
): Partial<Record<StoreKey, ProviderResult>> {
  const providers: Partial<Record<StoreKey, ProviderResult>> = {};
  for (const store of resolveRequestedStores(marketplace)) {
    providers[store] = result;
  }
  return providers;
}

// Calls the search-products Edge Function (real Amazon PA-API / Flipkart
// Affiliate API search — see supabase/functions/search-products). Results
// are upserted server-side into `products`; call fetchProducts() /
// AppState's refreshProducts() afterwards to pick them up. The response is
// always HTTP 200 — per-provider status (success/not_configured/error/mock)
// lives in the JSON body, so callers must read `providers` rather than
// branch on the HTTP status code for business meaning.
export async function searchMarketplaces(query: string, marketplace: Marketplace = 'all'): Promise<MarketplaceSearchResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      query,
      mock: false,
      results: [],
      providers: buildFallbackProviders(marketplace, {
        status: 'not_configured',
        count: 0,
        upserted: 0,
        message: 'Store search isn’t connected yet — backend coming soon',
      }),
    };
  }

  const { data, error } = await supabase.functions.invoke<MarketplaceSearchResult>(
    'search-products',
    { body: { query, marketplace } },
  );

  if (error) {
    const context = (error as unknown as { context?: Response }).context;
    // The Edge Function's error responses use `{ error: string }` (see
    // supabase/functions/search-products/index.ts's `json({ error: ... })`
    // calls) — not `{ message: string }`. Reading the wrong key here means
    // the SDK's generic "non-2xx status code" message would always win over
    // the backend's specific, user-facing reason (e.g. "Query too long").
    const body = await context?.json().catch(() => null) as { error?: string } | null;
    const message = body?.error ?? error.message ?? 'Search failed';
    return {
      query,
      mock: false,
      results: [],
      providers: buildFallbackProviders(marketplace, { status: 'error', count: 0, upserted: 0, message }),
    };
  }
  if (!data) {
    return {
      query,
      mock: false,
      results: [],
      providers: buildFallbackProviders(marketplace, { status: 'error', count: 0, upserted: 0, message: 'Search failed' }),
    };
  }

  return data;
}
