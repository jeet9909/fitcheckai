import type { Product, Slot } from '../data/products';

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
  cartItems: { productId: number; qty: number }[];
  savedProductIds: number[];
  compareIds: number[];
  outfit: Record<Slot, number | null>;
  consent: { photos: boolean; sharing: boolean };
  profileSetupDone: boolean;
  tier: string;
  feedbackChoice: string | null;
  feedbackNote: string;
  feedbackSubmitted: boolean;
  error?: string;
}

export function fetchProducts(): Promise<Product[]> {
  return req('/products');
}

export function fetchState(): Promise<ApiState> {
  return req('/state');
}

export function addToCartApi(productId: number): Promise<ApiState> {
  return req('/cart', { method: 'POST', body: JSON.stringify({ productId }) });
}

export function removeFromCartApi(productId: number): Promise<ApiState> {
  return req(`/cart/${productId}`, { method: 'DELETE' });
}

export function toggleSavedApi(productId: number): Promise<ApiState> {
  return req('/saved/toggle', { method: 'POST', body: JSON.stringify({ productId }) });
}

export function toggleCompareApi(productId: number): Promise<ApiState> {
  return req('/compare/toggle', { method: 'POST', body: JSON.stringify({ productId }) });
}

export function setOutfitSlotApi(slot: Slot, productId: number | null): Promise<ApiState> {
  return req('/outfit', { method: 'POST', body: JSON.stringify({ slot, productId }) });
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

export function setTierApi(tier: string): Promise<ApiState> {
  return req('/tier', { method: 'POST', body: JSON.stringify({ tier }) });
}

export function updateFeedbackApi(body: { choice?: string; note?: string; submit?: boolean }): Promise<ApiState> {
  return req('/feedback', { method: 'POST', body: JSON.stringify(body) });
}

export function resetFeedbackApi(): Promise<ApiState> {
  return req('/feedback/reset', { method: 'POST' });
}
