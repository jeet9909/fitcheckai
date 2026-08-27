import type { Tone } from '../data/products';

export function fmt(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}

export function discountLabel(price: number, mrp: number): string {
  return Math.round((1 - price / mrp) * 100) + '% off';
}

export interface ConfidenceBand {
  color: string;
  bg: string;
  label: string;
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 85) return { color: 'var(--accent-dark)', bg: 'var(--accent-soft)', label: 'High confidence' };
  if (score >= 70) return { color: 'var(--amber-text)', bg: 'var(--amber-soft)', label: 'Medium confidence' };
  return { color: 'var(--red)', bg: 'var(--red-soft)', label: 'Low confidence — consider a clearer photo' };
}

export function recommendation(score: number): string {
  if (score >= 85) return 'Recommended — likely a comfortable, true-to-size fit based on your profile.';
  if (score >= 70) return 'Good match — minor adjustments possible in one or two areas.';
  return 'Review sizing — consider a size up or checking the store size chart.';
}

export function toneColor(tone: Tone): string {
  return tone === 'good' ? 'var(--accent-dark)' : tone === 'warn' ? 'var(--red)' : 'var(--amber-text)';
}

export function toneBg(tone: Tone): string {
  return tone === 'good' ? 'var(--accent-soft)' : tone === 'warn' ? 'var(--red-soft)' : 'var(--amber-soft)';
}

export function fitColor(score: number): string {
  return score >= 85 ? 'var(--accent-dark)' : score >= 70 ? 'var(--amber-text)' : 'var(--red)';
}

export function fitBg(score: number): string {
  return score >= 85 ? 'var(--accent-soft)' : score >= 70 ? 'var(--amber-soft)' : 'var(--red-soft)';
}
