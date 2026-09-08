// Single source of truth for showing a "rating" anywhere in the app.
// There is no real ratings/reviewCount field in the product data model (see
// data/products.ts's Product interface) — only a 0-100 AI fitScore. This
// derives a familiar 1-5 star number from that fitScore so the UI can show
// something legible without ever fabricating a reviewCount or an actual
// customer rating.
export function ratingFromFitScore(fitScore: number): number {
  const clamped = Math.min(100, Math.max(0, fitScore));
  const rating = 1 + (clamped / 100) * 4;
  return Math.round(rating * 10) / 10;
}
