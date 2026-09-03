// Curated list of common apparel search terms used to proactively warm the
// `products` catalog (see index.ts) — the same terms a real Discover user
// is likely to search for, run ahead of time across all 6 stores so those
// searches can be served from the local cache (search-products/
// localCatalog.ts) instead of a live API/scrape attempt on the user's own
// request.
//
// Order matters a little: index.ts's default (no `terms` in the request
// body) takes the first few entries, so the most common/general categories
// are listed first — a caller doing incremental population passes a
// `terms` slice explicitly (see supabase/README.md's invocation examples).
export const SEARCH_TERMS: string[] = [
  'shirts',
  't-shirts',
  'jeans',
  'trousers',
  'dresses',
  'shoes',
  'sneakers',
  'jackets',
  'watches',
  'sunglasses',
  'kurtas',
  'sarees',
  'hoodies',
  'track pants',
  'sandals',
  'tops',
  'skirts',
  'formal shoes',
  'belts',
  'handbags',
];

// How many SEARCH_TERMS entries index.ts uses when a request omits `terms`
// entirely — a small starter batch, not the whole list, so a single
// no-args invocation can't accidentally run long enough to risk the Edge
// Function's wall-clock limit (see index.ts's header comment).
export const DEFAULT_TERM_COUNT = 5;
