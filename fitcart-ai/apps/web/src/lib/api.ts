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
