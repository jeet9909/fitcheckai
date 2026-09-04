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

// Shared field-size/count caps — the single source of truth for both
// callers of updateProduct(): curate-product/index.ts's HTTP layer (which
// re-checks these up front for a fast, pre-DB-lookup 400) and updateProduct
// itself (enforced below, unconditionally, for *every* caller — including
// fetch-product/index.ts's enrichment write and enrich-catalog/candidates.ts's
// batch loop, neither of which goes through curate-product/index.ts's HTTP
// validation at all). Moving these here — rather than leaving them only in
// curate-product/index.ts — is what closes that gap: a caller that reaches
// updateProduct() directly can no longer bypass them, by construction, not
// by convention.
export const MAX_DESCRIPTION_LENGTH = 5000;
// Short free-text fields — same cap curate-match uses for its own `label`.
export const MAX_SHORT_FIELD_LENGTH = 200;
// ~4KB of serialized JSON — generous for any real chest/waist/inseam-style
// chart, but a real cap against a pathologically huge payload.
export const MAX_SIZE_CHART_JSON_LENGTH = 4000;
export const MAX_IMAGE_URLS = 10;
export const MAX_IMAGE_URL_LENGTH = 2000;

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
// mention this time. Steps:
//   0. every provided field is checked against the shared MAX_* caps above
//      (length/count only — pure, no DB) — enforced here, not only in
//      curate-product/index.ts's HTTP layer, so a caller that reaches this
//      function directly (fetch-product/index.ts's enrichment write,
//      enrich-catalog/candidates.ts's batch loop) gets the exact same
//      protection a human curator's HTTP request already does, never a
//      bypass.
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

  // Size/count validation, enforced here (not just in curate-product/
  // index.ts's HTTP layer) so every caller gets the same real protection —
  // including fetch-product/index.ts's enrichment write and
  // enrich-catalog/candidates.ts's batch loop, neither of which is
  // HTTP-request-validated the way curate-product/index.ts's own callers
  // are. Checked before the DB lookup below: a doomed request shouldn't cost
  // a round trip, same "fail fast on shape/size before touching the DB"
  // posture curate-product/index.ts's own pre-checks already have.
  if (description !== undefined && description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, status: 400, error: `\`description\` too long — max ${MAX_DESCRIPTION_LENGTH} characters.` };
  }
  if (material !== undefined && material.length > MAX_SHORT_FIELD_LENGTH) {
    return { ok: false, status: 400, error: `\`material\` too long — max ${MAX_SHORT_FIELD_LENGTH} characters.` };
  }
  if (sizeChart !== undefined) {
    let serializedLength: number;
    try {
      serializedLength = JSON.stringify(sizeChart).length;
    } catch {
      return { ok: false, status: 400, error: '`sizeChart` could not be serialized — it must be plain JSON-safe data.' };
    }
    if (serializedLength > MAX_SIZE_CHART_JSON_LENGTH) {
      return {
        ok: false,
        status: 400,
        error: `\`sizeChart\` too large — serialized JSON must be at most ${MAX_SIZE_CHART_JSON_LENGTH} characters.`,
      };
    }
  }
  if (imageUrls !== undefined) {
    if (imageUrls.length > MAX_IMAGE_URLS) {
      return { ok: false, status: 400, error: `\`imageUrls\` must contain at most ${MAX_IMAGE_URLS} URLs.` };
    }
    const tooLong = imageUrls.find((url) => url.length > MAX_IMAGE_URL_LENGTH);
    if (tooLong !== undefined) {
      return {
        ok: false,
        status: 400,
        error: `\`imageUrls\` contains a URL longer than ${MAX_IMAGE_URL_LENGTH} characters.`,
      };
    }
  }

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
