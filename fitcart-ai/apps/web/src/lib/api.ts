import type { Product } from '../data/products';

const BASE = '/api';

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

export function fetchProducts(): Promise<Product[]> {
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
