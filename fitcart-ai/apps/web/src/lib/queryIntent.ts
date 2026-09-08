// Lightweight, best-effort natural-language filter extraction for the search
// box (AppHeader) and the "ask for what you want" example chips on Landing.
// This is a UX affordance, not a real NLU pipeline — it only ever reports
// fields it's confident about via simple keyword/regex matching, and omits
// (never guesses) anything it can't parse. Downstream code (Discover's
// filtering) should treat every field as optional.

export interface QueryIntent {
  color?: string;
  fit?: string;
  category?: string;
  maxPrice?: number;
}

const COLORS = [
  'black', 'white', 'grey', 'gray', 'navy', 'blue', 'red', 'green', 'yellow',
  'pink', 'purple', 'brown', 'beige', 'orange', 'maroon', 'olive', 'cream', 'tan',
];

const FITS = ['oversized', 'relaxed', 'regular', 'slim', 'skinny', 'loose', 'tailored'];

const CATEGORIES = [
  't-shirt', 'tshirt', 'tee', 'shirt', 'jeans', 'trousers', 'pants', 'shorts',
  'jacket', 'hoodie', 'sweater', 'dress', 'skirt', 'kurta', 'saree', 'shoes',
  'sneakers', 'sandals', 'watch', 'sunglasses', 'top', 'blazer', 'coat',
];

function normalizeCategory(match: string): string {
  if (match === 'tshirt' || match === 'tee') return 't-shirt';
  return match;
}

/**
 * Extracts "under ₹1,000" / "under 1000" / "under $50" style price ceilings.
 * Commas inside the number are stripped before parsing.
 */
function parseMaxPrice(query: string): number | undefined {
  const match = query.match(/under\s*[₹$€£]?\s*([\d,]+)/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function findKeyword(query: string, keywords: string[], allowPlural = false): string | undefined {
  const lower = query.toLowerCase();
  for (const keyword of keywords) {
    const pattern = allowPlural ? `\\b${keyword}s?\\b` : `\\b${keyword}\\b`;
    if (new RegExp(pattern, 'i').test(lower)) return keyword;
  }
  return undefined;
}

export function parseQueryIntent(query: string): QueryIntent {
  const intent: QueryIntent = {};

  const color = findKeyword(query, COLORS);
  if (color) intent.color = color === 'gray' ? 'grey' : color;

  const fit = findKeyword(query, FITS);
  if (fit) intent.fit = fit;

  const category = findKeyword(query, CATEGORIES, true);
  if (category) intent.category = normalizeCategory(category);

  const maxPrice = parseMaxPrice(query);
  if (maxPrice !== undefined) intent.maxPrice = maxPrice;

  return intent;
}
