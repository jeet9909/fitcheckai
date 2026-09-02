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
  fit_score: number;
  confidence: number;
  breakdown: unknown;
  source: string;
  product_url: string | null;
  image_url: string | null;
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
    fitScore: row.fit_score,
    confidence: row.confidence,
    breakdown: (row.breakdown ?? []) as Product['breakdown'],
    source: row.source,
    productUrl: row.product_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
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

export type Marketplace = 'amazon' | 'flipkart' | 'all';

export interface StoreListing {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  productUrl: string;
  store: 'Amazon' | 'Flipkart';
  source?: 'live' | 'mock';
}

export type ProviderStatus = 'success' | 'not_configured' | 'error' | 'mock';

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
  providers: Partial<Record<'amazon' | 'flipkart', ProviderResult>>;
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
      providers: {
        amazon: { status: 'not_configured', count: 0, upserted: 0, message: 'Store search isn’t connected yet — backend coming soon' },
        flipkart: { status: 'not_configured', count: 0, upserted: 0, message: 'Store search isn’t connected yet — backend coming soon' },
      },
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
      providers: {
        amazon: { status: 'error', count: 0, upserted: 0, message },
        flipkart: { status: 'error', count: 0, upserted: 0, message },
      },
    };
  }
  if (!data) {
    return {
      query,
      mock: false,
      results: [],
      providers: {
        amazon: { status: 'error', count: 0, upserted: 0, message: 'Search failed' },
        flipkart: { status: 'error', count: 0, upserted: 0, message: 'Search failed' },
      },
    };
  }

  return data;
}
