import type { Product, Slot } from '../data/products';

/**
 * Static-hosting mock of the Cloudflare Pages Functions + D1 backend.
 *
 * GitHub Pages serves static files only — there is no server to hit at
 * `/api/*`. This module keeps the exact same function signatures and
 * `ApiState` shape as the real API (see `functions/api/*.ts` +
 * `functions/api/_lib/state.ts`) so every page/component built against
 * `lib/api.ts` keeps working unmodified, but reads/writes `localStorage`
 * instead of making network calls. Swap this file back to real `fetch`
 * calls once the Cloudflare Functions backend is deployed and reachable.
 */

const STORAGE_KEY = 'fitcart_mock_db_v1';
const LATENCY_MS = 120;

const SEED_PRODUCTS: Product[] = [
  { id: 1, name: 'Oxford Weave Shirt', brand: 'Everest & Co', store: 'Myntra', category: 'Shirts', bucket: 'Clothing', slot: 'top', price: 1499, mrp: 2499, color: 'White', material: 'Cotton', fitScore: 91, confidence: 88, source: 'curated', breakdown: [{ label: 'Shoulders', value: 'Excellent', tone: 'good' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Waist', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Excellent', tone: 'good' }] },
  { id: 2, name: 'Slim Fit Chinos', brand: 'Loom & Field', store: 'AJIO', category: 'Trousers', bucket: 'Clothing', slot: 'bottom', price: 1799, mrp: 2999, color: 'Khaki', material: 'Cotton blend', fitScore: 84, confidence: 79, source: 'curated', breakdown: [{ label: 'Waist', value: 'Good', tone: 'good' }, { label: 'Hip', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Slightly long', tone: 'ok' }, { label: 'Thigh', value: 'Good', tone: 'good' }] },
  { id: 3, name: 'Classic Court Sneakers', brand: 'Northline', store: 'Amazon', category: 'Sneakers', bucket: 'Shoes', slot: 'shoes', price: 3299, mrp: 3999, color: 'White', material: 'Leather', fitScore: 88, confidence: 85, source: 'curated', breakdown: [{ label: 'Length', value: 'Good', tone: 'good' }, { label: 'Width', value: 'Good', tone: 'good' }, { label: 'Arch support', value: 'Excellent', tone: 'good' }, { label: 'Heel', value: 'Good', tone: 'good' }] },
  { id: 4, name: 'Minimalist Steel Watch', brand: 'Aurel', store: 'Flipkart', category: 'Watches', bucket: 'Watches', slot: 'watch', price: 4999, mrp: 6499, color: 'Silver', material: 'Stainless steel', fitScore: 95, confidence: 90, source: 'curated', breakdown: [{ label: 'Strap', value: 'Excellent', tone: 'good' }, { label: 'Case size', value: 'Good', tone: 'good' }, { label: 'Weight', value: 'Good', tone: 'good' }, { label: 'Clasp', value: 'Excellent', tone: 'good' }] },
  { id: 5, name: 'Structured Blazer', brand: 'Veranda', store: 'Nykaa Fashion', category: 'Jackets', bucket: 'Clothing', slot: 'top', price: 5999, mrp: 8999, color: 'Charcoal', material: 'Wool blend', fitScore: 76, confidence: 71, source: 'curated', breakdown: [{ label: 'Shoulders', value: 'Slightly tight', tone: 'warn' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Sleeve length', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }] },
  { id: 6, name: 'Relaxed Denim Jacket', brand: 'Fieldwork', store: 'Meesho', category: 'Jackets', bucket: 'Clothing', slot: 'top', price: 1299, mrp: 2199, color: 'Indigo', material: 'Denim', fitScore: 82, confidence: 74, source: 'curated', breakdown: [{ label: 'Shoulders', value: 'Good', tone: 'good' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Sleeve length', value: 'Slightly long', tone: 'ok' }, { label: 'Length', value: 'Good', tone: 'good' }] },
  { id: 7, name: 'Straight Fit Jeans', brand: 'Loom & Field', store: 'Myntra', category: 'Jeans', bucket: 'Clothing', slot: 'bottom', price: 2199, mrp: 3499, color: 'Dark Blue', material: 'Denim', fitScore: 89, confidence: 86, source: 'curated', breakdown: [{ label: 'Waist', value: 'Good', tone: 'good' }, { label: 'Hip', value: 'Excellent', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }, { label: 'Thigh', value: 'Good', tone: 'good' }] },
  { id: 8, name: 'Trail Running Trainers', brand: 'Northline', store: 'Flipkart', category: 'Sneakers', bucket: 'Shoes', slot: 'shoes', price: 3799, mrp: 4999, color: 'Black', material: 'Mesh', fitScore: 79, confidence: 68, source: 'curated', breakdown: [{ label: 'Length', value: 'Good', tone: 'good' }, { label: 'Width', value: 'Slightly narrow', tone: 'warn' }, { label: 'Arch support', value: 'Good', tone: 'good' }, { label: 'Heel', value: 'Good', tone: 'good' }] },
  { id: 9, name: 'Aviator Sunglasses', brand: 'Solstice', store: 'Amazon', category: 'Sunglasses', bucket: 'Sunglasses', slot: 'accessory', price: 1599, mrp: 2299, color: 'Gold', material: 'Metal', fitScore: 93, confidence: 91, source: 'curated', breakdown: [{ label: 'Frame width', value: 'Excellent', tone: 'good' }, { label: 'Bridge fit', value: 'Good', tone: 'good' }, { label: 'Temple length', value: 'Good', tone: 'good' }, { label: 'Weight', value: 'Excellent', tone: 'good' }] },
  { id: 10, name: 'Canvas Tote', brand: 'Fieldwork', store: 'AJIO', category: 'Accessories', bucket: 'Accessories', slot: 'accessory', price: 899, mrp: 1299, color: 'Natural', material: 'Canvas', fitScore: 96, confidence: 94, source: 'curated', breakdown: [{ label: 'Strap length', value: 'Excellent', tone: 'good' }, { label: 'Capacity', value: 'Excellent', tone: 'good' }, { label: 'Weight', value: 'Good', tone: 'good' }, { label: 'Closure', value: 'Good', tone: 'good' }] },
  { id: 11, name: 'Merino Crewneck', brand: 'Everest & Co', store: 'Nykaa Fashion', category: 'Sweaters', bucket: 'Clothing', slot: 'top', price: 2499, mrp: 3999, color: 'Forest Green', material: 'Merino wool', fitScore: 87, confidence: 83, source: 'curated', breakdown: [{ label: 'Shoulders', value: 'Good', tone: 'good' }, { label: 'Chest', value: 'Good', tone: 'good' }, { label: 'Sleeve length', value: 'Excellent', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }] },
  { id: 12, name: 'Pleated Trousers', brand: 'Veranda', store: 'Myntra', category: 'Trousers', bucket: 'Clothing', slot: 'bottom', price: 2799, mrp: 3999, color: 'Stone', material: 'Wool blend', fitScore: 72, confidence: 65, source: 'curated', breakdown: [{ label: 'Waist', value: 'Slightly loose', tone: 'warn' }, { label: 'Hip', value: 'Good', tone: 'good' }, { label: 'Length', value: 'Good', tone: 'good' }, { label: 'Thigh', value: 'Slightly loose', tone: 'warn' }] },
  { id: 13, name: 'Leather Chelsea Boots', brand: 'Northline', store: 'AJIO', category: 'Boots', bucket: 'Shoes', slot: 'shoes', price: 4499, mrp: 5999, color: 'Brown', material: 'Leather', fitScore: 85, confidence: 80, source: 'curated', breakdown: [{ label: 'Length', value: 'Good', tone: 'good' }, { label: 'Width', value: 'Good', tone: 'good' }, { label: 'Ankle fit', value: 'Good', tone: 'good' }, { label: 'Heel', value: 'Excellent', tone: 'good' }] },
  { id: 14, name: 'Chronograph Watch', brand: 'Aurel', store: 'Amazon', category: 'Watches', bucket: 'Watches', slot: 'watch', price: 7999, mrp: 10999, color: 'Black / Gold', material: 'Titanium', fitScore: 90, confidence: 88, source: 'curated', breakdown: [{ label: 'Strap', value: 'Excellent', tone: 'good' }, { label: 'Case size', value: 'Good', tone: 'good' }, { label: 'Weight', value: 'Good', tone: 'good' }, { label: 'Clasp', value: 'Excellent', tone: 'good' }] },
];

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

interface MockDb {
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
}

function seedDb(): MockDb {
  return {
    cartItems: [{ productId: 7, qty: 1 }],
    savedProductIds: [10],
    compareIds: [3, 8],
    outfit: { top: 1, bottom: null, shoes: 3, watch: null, accessory: null },
    consent: { photos: false, sharing: false },
    profileSetupDone: false,
    tier: 'style',
    feedbackChoice: null,
    feedbackNote: '',
    feedbackSubmitted: false,
  };
}

function loadDb(): MockDb {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through to reseed
  }
  const seeded = seedDb();
  saveDb(seeded);
  return seeded;
}

function saveDb(db: MockDb): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function toState(db: MockDb): ApiState {
  return {
    cartItems: db.cartItems,
    savedProductIds: db.savedProductIds,
    compareIds: db.compareIds,
    outfit: db.outfit,
    consent: db.consent,
    profileSetupDone: db.profileSetupDone,
    tier: db.tier,
    feedbackChoice: db.feedbackChoice,
    feedbackNote: db.feedbackNote,
    feedbackSubmitted: db.feedbackSubmitted,
  };
}

function mutate(fn: (db: MockDb) => void): Promise<ApiState> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const db = loadDb();
      fn(db);
      saveDb(db);
      resolve(toState(db));
    }, LATENCY_MS);
  });
}

function read(): Promise<ApiState> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(toState(loadDb())), LATENCY_MS);
  });
}

export function fetchProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(SEED_PRODUCTS), LATENCY_MS);
  });
}

export function fetchState(): Promise<ApiState> {
  return read();
}

export function addToCartApi(productId: number): Promise<ApiState> {
  return mutate((db) => {
    if (!db.cartItems.some((c) => c.productId === productId)) {
      db.cartItems.push({ productId, qty: 1 });
    }
  });
}

export function removeFromCartApi(productId: number): Promise<ApiState> {
  return mutate((db) => {
    db.cartItems = db.cartItems.filter((c) => c.productId !== productId);
  });
}

export function toggleSavedApi(productId: number): Promise<ApiState> {
  return mutate((db) => {
    db.savedProductIds = db.savedProductIds.includes(productId)
      ? db.savedProductIds.filter((id) => id !== productId)
      : [...db.savedProductIds, productId];
  });
}

export function toggleCompareApi(productId: number): Promise<ApiState> {
  return mutate((db) => {
    db.compareIds = db.compareIds.includes(productId)
      ? db.compareIds.filter((id) => id !== productId)
      : [...db.compareIds, productId];
  });
}

export function setOutfitSlotApi(slot: Slot, productId: number | null): Promise<ApiState> {
  return mutate((db) => {
    db.outfit[slot] = productId;
  });
}

export function toggleConsentApi(key: 'photos' | 'sharing'): Promise<ApiState> {
  return mutate((db) => {
    db.consent[key] = !db.consent[key];
  });
}

export function setupProfileApi(): Promise<ApiState> {
  return mutate((db) => {
    db.profileSetupDone = true;
  });
}

export function deleteProfileApi(): Promise<ApiState> {
  return mutate((db) => {
    db.profileSetupDone = false;
  });
}

export function setTierApi(tier: string): Promise<ApiState> {
  return mutate((db) => {
    db.tier = tier;
  });
}

export function updateFeedbackApi(body: { choice?: string; note?: string; submit?: boolean }): Promise<ApiState> {
  return mutate((db) => {
    if (body.choice !== undefined) db.feedbackChoice = body.choice;
    if (body.note !== undefined) db.feedbackNote = body.note;
    if (body.submit) db.feedbackSubmitted = true;
  });
}

export function resetFeedbackApi(): Promise<ApiState> {
  return mutate((db) => {
    db.feedbackChoice = null;
    db.feedbackNote = '';
    db.feedbackSubmitted = false;
  });
}
