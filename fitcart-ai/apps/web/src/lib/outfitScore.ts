import { SLOT_ORDER, type Product } from '../data/products';
import type { OutfitState } from '../state/AppState';

export interface OutfitScore {
  overall: number;
  colorHarmony: number;
  styleMatch: number;
  occasionFit: number;
  why: string;
}

export function computeOutfitScore(outfit: OutfitState, products: Product[]): OutfitScore | null {
  const filled = SLOT_ORDER
    .map((slot) => (outfit[slot] ? products.find((p) => p.id === outfit[slot]) : null))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (filled.length < 2) return null;

  const avgFit = Math.round(filled.reduce((a, p) => a + p.fitScore, 0) / filled.length);
  const topProduct = outfit.top ? products.find((p) => p.id === outfit.top) : null;
  const shoesProduct = outfit.shoes ? products.find((p) => p.id === outfit.shoes) : null;

  return {
    overall: Math.min(97, avgFit + 4),
    colorHarmony: 92,
    styleMatch: 88,
    occasionFit: 84,
    why:
      'The ' + (topProduct ? topProduct.color.toLowerCase() + ' ' + topProduct.category.toLowerCase() : 'top') +
      ' pairs cleanly with the ' + (shoesProduct ? shoesProduct.category.toLowerCase() : 'shoes') +
      '’s minimal silhouette — a versatile combination suited for smart-casual daytime occasions.',
  };
}
