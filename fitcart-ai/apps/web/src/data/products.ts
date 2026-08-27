export type Tone = 'good' | 'warn' | 'ok';
export type Slot = 'top' | 'bottom' | 'shoes' | 'watch' | 'accessory';

export interface BreakdownRow {
  label: string;
  value: string;
  tone: Tone;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  store: string;
  category: string;
  bucket: string;
  slot: Slot;
  price: number;
  mrp: number;
  color: string;
  material: string;
  fitScore: number;
  confidence: number;
  breakdown: BreakdownRow[];
  source: string;
}

export const STORES = ['Myntra', 'AJIO', 'Amazon', 'Flipkart', 'Meesho', 'Nykaa Fashion'];
export const BUCKETS = ['All', 'Clothing', 'Shoes', 'Accessories', 'Watches', 'Sunglasses'];

export const SLOT_LABELS: Record<Slot, string> = {
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  watch: 'Watch',
  accessory: 'Accessory',
};

export const SLOT_ORDER: Slot[] = ['top', 'bottom', 'shoes', 'watch', 'accessory'];
