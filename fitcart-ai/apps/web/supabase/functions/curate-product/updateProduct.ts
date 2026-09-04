// DB-touching core of curate-product, extracted out of index.ts so it can be
// exercised against a fake Supabase client (no real DB) in
// updateProduct.test.ts — the same split curate-match uses (index.ts /
// matchGroups.ts) and search-products uses (cacheFirstSearch.ts /
// localCatalog.ts). index.ts's Deno.serve handler validates the request
// body's shape synchronously, then calls updateProduct for anything that
// needs a real DB round-trip (does the product exist? is its store known
// well enough to validate imageUrls against?) and maps the result to a
// Response.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAllowedMarketplaceUrl } from '../search-products/urlAllowlist.ts';
import type { StoreListing } from '../search-products/types.ts';

type Store = StoreListing['store'];

// products.store is a plain `text` column (no DB-level enum/check), but
// isAllowedMarketplaceUrl's ALLOWED_HOSTS table is keyed by the narrower
// `Store` union that every real scraper/API adapter writes (see types.ts's
// comment on StoreListing.store). A row whose store value isn't one of
// these six is either bad data or a store this function has no allowlist
// for — either way, there's no domain list to validate an imageUrls entry
// against, so such a product must reject any imageUrls update rather than
// silently accept an unvalidated URL.
const KNOWN_STORES = new Set<string>(['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'AJIO', 'Nykaa Fashion']);
function isKnownStore(store: string): store is Store {
  return KNOWN_STORES.has(store);
}

export interface UpdateProductInput {
  productId: number;
  description?: string;
  material?: string;
  sizeChart?: Record<string, unknown>;
  imageUrls?: string[];
}

export interface UpdateProductFields {
  description?: string;
  material?: string;
  sizeChart?: Record<string, unknown>;
  imageUrls?: string[];
}

export interface UpdateProductSuccess {
  ok: true;
  productId: number;
  updated: UpdateProductFields;
}

export interface UpdateProductFailure {
  ok: false;
  status: 400 | 500;
  error: string;
}

export type UpdateProductResult = UpdateProductSuccess | UpdateProductFailure;

interface ProductStoreRow {
  id: number;
  store: string;
}

// Updates only the fields actually present on `input` — a real partial
// update (`UPDATE products SET <only the provided columns> WHERE id = ...`),
// never a full-row overwrite that would blank out fields the curator didn't
// mention this time. Steps, every one a real DB check, nothing assumed:
//   1. `productId` must already exist in `products` (real SELECT, same
//      posture as curate-match's productIds check).
//   2. if `imageUrls` is present, every URL must pass isAllowedMarketplaceUrl
//      for *this product's own* `store` column — looked up here, not
//      trusted from the request — same defense-in-depth the scraping
//      pipeline already applies to `product_url`/`image_url` at ingest time
//      (search-products/urlAllowlist.ts), now applied to curator input too.
//   3. a single UPDATE for the provided columns.
export async function updateProduct(
  supabaseAdmin: SupabaseClient,
  input: UpdateProductInput,
): Promise<UpdateProductResult> {
  const { productId, description, material, sizeChart, imageUrls } = input;

  const { data: productRow, error: lookupError } = await supabaseAdmin
    .from('products')
    .select('id, store')
    .eq('id', productId)
    .maybeSingle();

  if (lookupError) {
    console.error('[curate-product] failed to look up product:', lookupError);
    return { ok: false, status: 500, error: 'Could not verify the given product id against the catalog. Try again.' };
  }
  if (!productRow) {
    return { ok: false, status: 400, error: `Unknown product id: ${productId}. It must already exist in the catalog.` };
  }
  const store = (productRow as ProductStoreRow).store;

  const updatePayload: Record<string, unknown> = {};
  const updated: UpdateProductFields = {};

  if (description !== undefined) {
    updatePayload.description = description;
    updated.description = description;
  }
  if (material !== undefined) {
    updatePayload.material = material;
    updated.material = material;
  }
  if (sizeChart !== undefined) {
    updatePayload.size_chart = sizeChart;
    updated.sizeChart = sizeChart;
  }
  if (imageUrls !== undefined) {
    if (!isKnownStore(store)) {
      return {
        ok: false,
        status: 400,
        error: `Cannot validate \`imageUrls\` — product ${productId}'s store ("${store}") is not one of the marketplaces this function has a URL allowlist for.`,
      };
    }
    const badUrl = imageUrls.find((url) => !isAllowedMarketplaceUrl(store, url));
    if (badUrl !== undefined) {
      return {
        ok: false,
        status: 400,
        error: `\`imageUrls\` contains a URL that isn't allowlisted for ${store}: "${badUrl}". Every image URL must point at a domain allowlisted for this product's own store.`,
      };
    }
    updatePayload.image_urls = imageUrls;
    updated.imageUrls = imageUrls;
  }

  // `.eq('store', store)` closes the TOCTOU window between the SELECT above
  // (where `store` was read) and this UPDATE: if `imageUrls` was validated
  // against `store`, the write must only land on a row that still has that
  // exact `store` value, never on a row whose store changed underneath us
  // (e.g. a concurrent re-scrape landing between the read and the write).
  // Chaining `.select('id')` is what makes the affected-row-count visible at
  // all — PostgREST (what supabase-js's `.update()` talks to) only returns
  // the updated rows when a representation is explicitly requested via
  // `.select()`; without it, `data` is always null and a same-store-but-
  // zero-rows-matched update is indistinguishable from a real one. An empty
  // `data` array here is proof positive that the `id`+`store` pair the WHERE
  // clause needed no longer both held — i.e. the row's `store` moved between
  // the SELECT and this UPDATE — and that is reported as a real, specific
  // conflict, never silently swallowed into a false "success".
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from('products')
    .update(updatePayload)
    .eq('id', productId)
    .eq('store', store)
    .select('id');

  if (updateError) {
    console.error('[curate-product] failed to update product:', updateError);
    return { ok: false, status: 500, error: 'Failed to save the curated fields. Nothing was changed.' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Same posture as curate-match/matchGroups.ts's unique-violation-on-
    // insert handling for its own TOCTOU race: a real, user-facing 400
    // naming the actual cause, not a generic 500 and not a silently-empty
    // success.
    return {
      ok: false,
      status: 400,
      error: `Product ${productId}'s store changed (it's no longer "${store}") between being looked up and this update being applied — the imageUrls validation above may now be stale. Nothing was changed. Please retry.`,
    };
  }

  return { ok: true, productId, updated };
}
