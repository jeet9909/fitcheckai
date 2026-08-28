import type { Product } from '../data/products';
import type { ApiState } from './api';

// Standalone browser-only backend for static hosting (GitHub Pages), where
// there is no Cloudflare Functions/D1 backend to call. Installed only when
// VITE_MOCK_API is set at build time — see vite.config.ts. Persists to
// localStorage so state survives a refresh; nothing here is shared across
// devices or users. Real backend (auth, payments, product catalog) replaces
// this once it exists.

const STORAGE_KEY = 'fitcart_mock_state_v1';

const SEED_PRODUCTS: Product[] = [
  { id: 1, name: 'Oxford Weave Shirt', brand: 'Everest & Co', store: 'Myntra', category: 'Shirts', bucket: 'Clothing', slot: 'top', price: 1499, mrp: 2499, color: 'White', material: 'Cotton', fitScore: 91, confidence: 88, breakdown: [{ label: 'Shoulders', value: 'Excellent', tone: 'good' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Waist', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Excellent', tone: 'good' }], source: 'curated' },
  { id: 2, name: 'Slim Fit Chinos', brand: 'Loom & Field', store: 'AJIO', category: 'Trousers', bucket: 'Clothing', slot: 'bottom', price: 1799, mrp: 2999, color: 'Khaki', material: 'Cotton blend', fitScore: 84, confidence: 79, breakdown: [{ label: 'Waist', value: 'Good', tone: 'good' }, { label: 'Hip', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Slightly long', tone: 'ok' }, { label: 'Thigh', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 3, name: 'Classic Court Sneakers', brand: 'Northline', store: 'Amazon', category: 'Sneakers', bucket: 'Shoes', slot: 'shoes', price: 3299, mrp: 3999, color: 'White', material: 'Leather', fitScore: 88, confidence: 85, breakdown: [{ label: 'Length', value: 'Good', tone: 'good' }, { label: 'Width', value: 'Good', tone: 'good' }, { label: 'Arch support', value: 'Excellent', tone: 'good' }, { label: 'Heel', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 4, name: 'Minimalist Steel Watch', brand: 'Aurel', store: 'Flipkart', category: 'Watches', bucket: 'Watches', slot: 'watch', price: 4999, mrp: 6499, color: 'Silver', material: 'Stainless steel', fitScore: 95, confidence: 90, breakdown: [{ label: 'Strap', value: 'Excellent', tone: 'good' }, { label: 'Case size', value: 'Good', tone: 'good' }, { label: 'Weight', value: 'Good', tone: 'good' }, { label: 'Clasp', value: 'Excellent', tone: 'good' }], source: 'curated' },
  { id: 5, name: 'Structured Blazer', brand: 'Veranda', store: 'Nykaa Fashion', category: 'Jackets', bucket: 'Clothing', slot: 'top', price: 5999, mrp: 8999, color: 'Charcoal', material: 'Wool blend', fitScore: 76, confidence: 71, breakdown: [{ label: 'Shoulders', value: 'Slightly tight', tone: 'warn' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Sleeve length', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 6, name: 'Relaxed Denim Jacket', brand: 'Fieldwork', store: 'Meesho', category: 'Jackets', bucket: 'Clothing', slot: 'top', price: 1299, mrp: 2199, color: 'Indigo', material: 'Denim', fitScore: 82, confidence: 74, breakdown: [{ label: 'Shoulders', value: 'Good', tone: 'good' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Sleeve length', value: 'Slightly long', tone: 'ok' }, { label: 'Length', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 7, name: 'Straight Fit Jeans', brand: 'Loom & Field', store: 'Myntra', category: 'Jeans', bucket: 'Clothing', slot: 'bottom', price: 2199, mrp: 3499, color: 'Dark Blue', material: 'Denim', fitScore: 89, confidence: 86, breakdown: [{ label: 'Waist', value: 'Good', tone: 'good' }, { label: 'Hip', value: 'Excellent', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }, { label: 'Thigh', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 8, name: 'Trail Running Trainers', brand: 'Northline', store: 'Flipkart', category: 'Sneakers', bucket: 'Shoes', slot: 'shoes', price: 3799, mrp: 4999, color: 'Black', material: 'Mesh', fitScore: 79, confidence: 68, breakdown: [{ label: 'Length', value: 'Good', tone: 'good' }, { label: 'Width', value: 'Slightly narrow', tone: 'warn' }, { label: 'Arch support', value: 'Good', tone: 'good' }, { label: 'Heel', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 9, name: 'Aviator Sunglasses', brand: 'Solstice', store: 'Amazon', category: 'Sunglasses', bucket: 'Sunglasses', slot: 'accessory', price: 1599, mrp: 2299, color: 'Gold', material: 'Metal', fitScore: 93, confidence: 91, breakdown: [{ label: 'Frame width', value: 'Excellent', tone: 'good' }, { label: 'Bridge fit', value: 'Good', tone: 'good' }, { label: 'Temple length', value: 'Good', tone: 'good' }, { label: 'Weight', value: 'Excellent', tone: 'good' }], source: 'curated' },
  { id: 10, name: 'Canvas Tote', brand: 'Fieldwork', store: 'AJIO', category: 'Accessories', bucket: 'Accessories', slot: 'accessory', price: 899, mrp: 1299, color: 'Natural', material: 'Canvas', fitScore: 96, confidence: 94, breakdown: [{ label: 'Strap length', value: 'Excellent', tone: 'good' }, { label: 'Capacity', value: 'Excellent', tone: 'good' }, { label: 'Weight', value: 'Good', tone: 'good' }, { label: 'Closure', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 11, name: 'Merino Crewneck', brand: 'Everest & Co', store: 'Nykaa Fashion', category: 'Sweaters', bucket: 'Clothing', slot: 'top', price: 2499, mrp: 3999, color: 'Forest Green', material: 'Merino wool', fitScore: 87, confidence: 83, breakdown: [{ label: 'Shoulders', value: 'Good', tone: 'good' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Sleeve length', value: 'Excellent', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }], source: 'curated' },
  { id: 12, name: 'Pleated Trousers', brand: 'Veranda', store: 'Myntra', category: 'Trousers', bucket: 'Clothing', slot: 'bottom', price: 2799, mrp: 3999, color: 'Stone', material: 'Wool blend', fitScore: 72, confidence: 65, breakdown: [{ label: 'Waist', value: 'Slightly loose', tone: 'warn' }, { label: 'Hip', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }, { label: 'Thigh', value: 'Slightly loose', tone: 'warn' }], source: 'curated' },
  { id: 13, name: 'Leather Chelsea Boots', brand: 'Northline', store: 'AJIO', category: 'Boots', bucket: 'Shoes', slot: 'shoes', price: 4499, mrp: 5999, color: 'Brown', material: 'Leather', fitScore: 85, confidence: 80, breakdown: [{ label: 'Length', value: 'Good', tone: 'good' }, { label: 'Width', value: 'Good', tone: 'good' }, { label: 'Ankle fit', value: 'Good', tone: 'good' }, { label: 'Heel', value: 'Excellent', tone: 'good' }], source: 'curated' },
  { id: 14, name: 'Chronograph Watch', brand: 'Aurel', store: 'Amazon', category: 'Watches', bucket: 'Watches', slot: 'watch', price: 7999, mrp: 10999, color: 'Black / Gold', material: 'Titanium', fitScore: 90, confidence: 88, breakdown: [{ label: 'Strap', value: 'Excellent', tone: 'good' }, { label: 'Case size', value: 'Good', tone: 'good' }, { label: 'Weight', value: 'Good', tone: 'good' }, { label: 'Clasp', value: 'Excellent', tone: 'good' }], source: 'curated' },
];

interface MockState {
  savedProductIds: number[];
  consent: { photos: boolean; sharing: boolean };
  profileSetupDone: boolean;
}

function defaultState(): MockState {
  return { savedProductIds: [10], consent: { photos: false, sharing: false }, profileSetupDone: false };
}

function loadState(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState(s: MockState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode etc.) — state just won't persist
  }
}

function toApiState(s: MockState): ApiState {
  return { savedProductIds: s.savedProductIds, consent: s.consent, profileSetupDone: s.profileSetupDone };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

export function installMockBackend() {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, init);

    const path = url.slice('/api'.length);
    const method = (init?.method ?? 'GET').toUpperCase();
    const state = loadState();

    if (path === '/products' && method === 'GET') {
      return jsonResponse(SEED_PRODUCTS);
    }

    if (path === '/state' && method === 'GET') {
      return jsonResponse(toApiState(state));
    }

    if (path === '/saved/toggle' && method === 'POST') {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const id = body.productId as number;
      state.savedProductIds = state.savedProductIds.includes(id)
        ? state.savedProductIds.filter((x) => x !== id)
        : [...state.savedProductIds, id];
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    if (path === '/consent' && method === 'POST') {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const key = body.key as 'photos' | 'sharing';
      state.consent = { ...state.consent, [key]: !state.consent[key] };
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    if (path === '/profile/setup' && method === 'POST') {
      state.profileSetupDone = true;
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    if (path === '/profile' && method === 'DELETE') {
      state.profileSetupDone = false;
      state.consent = { photos: false, sharing: false };
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    return jsonResponse({ error: `Mock backend: no handler for ${method} ${path}` });
  };
}
