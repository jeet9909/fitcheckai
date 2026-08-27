export interface Env {
  DB: D1Database;
}

export interface BreakdownRow {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'ok';
}

export interface Product {
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
  fitScore: number;
  confidence: number;
  breakdown: BreakdownRow[];
  source: string;
}

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
  breakdown: string;
  source: string;
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    store: row.store,
    category: row.category,
    bucket: row.bucket,
    slot: row.slot,
    price: row.price,
    mrp: row.mrp,
    color: row.color,
    material: row.material,
    fitScore: row.fit_score,
    confidence: row.confidence,
    breakdown: JSON.parse(row.breakdown),
    source: row.source,
  };
}

export async function getAllProducts(db: D1Database): Promise<Product[]> {
  const { results } = await db.prepare('SELECT * FROM products ORDER BY id').all<ProductRow>();
  return (results ?? []).map(rowToProduct);
}

export interface AppStateResponse {
  cartItems: { productId: number; qty: number }[];
  savedProductIds: number[];
  compareIds: number[];
  outfit: Record<string, number | null>;
  consent: { photos: boolean; sharing: boolean };
  profileSetupDone: boolean;
  tier: string;
  feedbackChoice: string | null;
  feedbackNote: string;
  feedbackSubmitted: boolean;
}

export async function getState(db: D1Database): Promise<AppStateResponse> {
  const stateRow = await db.prepare('SELECT * FROM app_state WHERE id = 1').first<{
    profile_setup_done: number;
    consent_photos: number;
    consent_sharing: number;
    tier: string;
    feedback_choice: string | null;
    feedback_note: string;
    feedback_submitted: number;
  }>();

  const { results: cartRows } = await db.prepare('SELECT product_id, qty FROM cart_items ORDER BY id').all<{ product_id: number; qty: number }>();
  const { results: savedRows } = await db.prepare('SELECT product_id FROM saved_products').all<{ product_id: number }>();
  const { results: compareRows } = await db.prepare('SELECT product_id FROM compare_items').all<{ product_id: number }>();
  const { results: outfitRows } = await db.prepare('SELECT slot, product_id FROM outfit_slots').all<{ slot: string; product_id: number | null }>();

  const outfit: Record<string, number | null> = { top: null, bottom: null, shoes: null, watch: null, accessory: null };
  for (const row of outfitRows ?? []) outfit[row.slot] = row.product_id;

  return {
    cartItems: (cartRows ?? []).map((r) => ({ productId: r.product_id, qty: r.qty })),
    savedProductIds: (savedRows ?? []).map((r) => r.product_id),
    compareIds: (compareRows ?? []).map((r) => r.product_id),
    outfit,
    consent: { photos: !!stateRow?.consent_photos, sharing: !!stateRow?.consent_sharing },
    profileSetupDone: !!stateRow?.profile_setup_done,
    tier: stateRow?.tier ?? 'style',
    feedbackChoice: stateRow?.feedback_choice ?? null,
    feedbackNote: stateRow?.feedback_note ?? '',
    feedbackSubmitted: !!stateRow?.feedback_submitted,
  };
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}
