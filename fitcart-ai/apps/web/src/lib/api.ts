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

export type StoreSearchResult =
  | { ok: true; count: number; upserted: number }
  | { ok: false; notConfigured: true; message: string }
  | { ok: false; notConfigured: false; message: string };

// Calls the search-products Edge Function (real Amazon PA-API / Flipkart
// Affiliate API search — see supabase/functions/search-products). Results
// are upserted server-side into `products`; call fetchProducts() /
// AppState's refreshProducts() afterwards to pick them up. Distinguishes
// "not configured" (no affiliate credentials set yet) from a genuine
// request failure so the UI can say which, instead of a generic error.
export async function searchStoreProducts(query: string, store: 'amazon' | 'flipkart'): Promise<StoreSearchResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, notConfigured: true, message: 'Store search isn’t connected yet — backend coming soon' };
  }

  const { data, error } = await supabase.functions.invoke<{ count: number; upserted: number; message?: string }>(
    'search-products',
    { body: { query, store } },
  );

  if (error) {
    const context = (error as unknown as { context?: Response }).context;
    const body = await context?.json().catch(() => null) as { error?: string; message?: string } | null;
    if (context?.status === 501) {
      return { ok: false, notConfigured: true, message: body?.message ?? `${store} search isn’t connected yet` };
    }
    return { ok: false, notConfigured: false, message: body?.message ?? error.message };
  }
  if (!data) {
    return { ok: false, notConfigured: false, message: 'Search failed' };
  }

  return { ok: true, count: data.count, upserted: data.upserted };
}
