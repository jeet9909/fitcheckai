// Pure mapping from a parser's output to curate-product's updateProduct()
// payload — extracted out of index.ts (rather than left inline there) so
// enrich-catalog (a separate Edge Function that re-runs these same parsers
// against already-catalogued products) can reuse the exact same mapping
// without importing fetch-product/index.ts itself, which registers its own
// top-level Deno.serve handler and constructs its own Supabase client at
// module scope — importing that file from a different Edge Function would
// mean two Deno.serve registrations and two client constructions sharing
// one isolate, which is not how this codebase's separate-function
// boundaries are meant to work (see populate-catalog/curate-match/
// curate-product's own index.ts files, none of which import each other's
// index.ts for this exact reason).

import type { ParsedProduct } from './parsers/types.ts';
import type { UpdateProductInput } from '../curate-product/updateProduct.ts';

// Builds curate-product's updateProduct() payload (minus `productId`, which
// only the caller knows) from a parser's output. Returns null when the
// parser found none of these richer fields at all, so the caller can skip
// the extra DB round trip entirely for a parser that only ever returned the
// base name/brand/price/etc. fields (still the common case for 5 of the 6
// stores — see each parser's own header comment).
export function buildEnrichmentInput(parsed: ParsedProduct): Omit<UpdateProductInput, 'productId'> | null {
  const fields: Omit<UpdateProductInput, 'productId'> = {};
  if (parsed.description) fields.description = parsed.description;
  if (parsed.material) fields.material = parsed.material;
  if (parsed.sizeChart) fields.sizeChart = parsed.sizeChart;
  if (parsed.imageUrls.length > 0) fields.imageUrls = parsed.imageUrls;
  return Object.keys(fields).length > 0 ? fields : null;
}
