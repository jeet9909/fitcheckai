// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy curate-product
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// CURATE_PRODUCT_SECRET (a random server-to-server secret — see
// supabase/README.md for how to generate/set it). Deliberately its own
// secret, not a reuse of CURATE_MATCH_SECRET or POPULATE_CATALOG_SECRET —
// same reasoning curate-match's own header comment already gives for why it
// doesn't reuse populate-catalog's secret: this is a distinct admin
// capability with a distinct blast radius (this one can rewrite a product's
// description/material/size chart/image gallery), and
// rotating/revoking one secret must never affect any of the others.
//
// Manual curation only — this is NOT scraping and NOT automated extraction.
// A real headless-browser scraping test (Playwright, run live against
// Myntra/AJIO/Meesho) confirmed the block on this richer product data
// (description, a real image gallery, size chart) is network/IP-level
// (Akamai edge bot-management), not header-based — scraping this data is
// not realistically achievable, so the project owner explicitly chose
// manual curation instead, the same pattern already committed to for
// cross-store price matching (curate-match). This function only ever writes
// the exact field values a human curator submitted in the request body — no
// extraction, no fabrication, nothing inferred from other rows.
//
// Security: POST-only, requires a matching `x-curate-product-secret` request
// header — same constant-time-comparison pattern as curate-match's
// `x-curate-match-secret` (see secretsMatch below). 401 (no detail leaked
// about what's missing/wrong) on failure. Server-to-server admin operation
// only — no frontend code knows this secret.
//
// Request body: { productId: number, description?: string, material?:
// string, sizeChart?: Record<string, unknown>, imageUrls?: string[] }
//   - `productId`: required, a positive integer no greater than
//     Number.MAX_SAFE_INTEGER (same float-precision id-collision guard as
//     curate-match's productIds check), and must already exist in
//     `products` (checked against the DB in updateProduct.ts, never
//     assumed).
//   - Every other field is optional, but at least one must be present — a
//     curator might only want to add a description today and a size chart
//     later, so this supports real partial updates; a request with every
//     optional field omitted has nothing to do and is a 400.
//   - `description`: string, capped at MAX_DESCRIPTION_LENGTH (real prose,
//     capped generously but not unbounded).
//   - `material`: string, capped at MAX_SHORT_FIELD_LENGTH — a short label,
//     same cap curate-match uses for its own `label` field. Note: `color` is
//     deliberately NOT a curator-writable field here, even though it's a
//     short label too — `color` is part of the payload
//     search-products/persistCatalog.ts's upsertListings writes on every
//     re-scrape of a product's `product_url`, so a curator-set `color` value
//     would be silently reverted the next time that product gets re-scraped.
//     `material` has no such conflict — it's excluded from that scrape
//     upsert payload — which is what makes it safe to curate here.
//   - `sizeChart`: must be a real JSON object if present (not an array, not
//     a primitive, not null) — intentionally loose-shaped rather than a
//     rigid schema, since different categories have different chart layouts
//     (chest/waist for tops, waist/inseam for bottoms), but its serialized
//     size is capped (MAX_SIZE_CHART_JSON_LENGTH) to defend against a
//     pathologically huge payload.
//   - `imageUrls`: array of strings, capped at MAX_IMAGE_URLS entries (a
//     gallery, not unlimited) and MAX_IMAGE_URL_LENGTH characters per URL.
//     Every URL must additionally pass search-products/urlAllowlist.ts's
//     isAllowedMarketplaceUrl for the product's own `store` column — that
//     check needs a DB lookup of the product's store, so it happens in
//     updateProduct.ts, not here; this layer only validates the array's
//     shape/size.
//
// Response: 200 with { productId, updated: { ...only the fields actually
// written } } — the same partial-update contract on the way out as on the
// way in; fields the curator didn't mention are never echoed back as
// changed (and are never touched in the underlying UPDATE — see
// updateProduct.ts). Every validation failure is a specific 400 (unknown
// product id, wrong field type, over-length field, malformed sizeChart,
// disallowed image URL naming which one and why) — never a vague "invalid
// request". A genuine DB failure is a 500 with a generic message; the real
// error is logged server-side only, never in the response body.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { updateProduct } from './updateProduct.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-curate-product-secret',
};

const MAX_DESCRIPTION_LENGTH = 5000;
// Short free-text fields — same cap curate-match uses for its own `label`.
const MAX_SHORT_FIELD_LENGTH = 200;
// ~4KB of serialized JSON — generous for any real chest/waist/inseam-style
// chart, but a real cap against a pathologically huge payload.
const MAX_SIZE_CHART_JSON_LENGTH = 4000;
const MAX_IMAGE_URLS = 10;
const MAX_IMAGE_URL_LENGTH = 2000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Same constant-time-ish comparison as curate-match/index.ts's
// secretsMatch — duplicated rather than imported since these are two
// independent Edge Functions guarding two independent secrets (see the file
// header for why they deliberately don't share one).
function secretsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Never logs the provided or expected secret value — only whether the
// request was authorized.
function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get('CURATE_PRODUCT_SECRET') ?? '';
  const provided = req.headers.get('x-curate-product-secret') ?? '';
  // An unset server-side secret must never be treated as "no secret
  // required" — an empty `expected` can only ever match an empty
  // `provided`, and an empty header is already excluded by requiring both
  // to be non-empty first.
  if (!expected || !provided) return false;
  return secretsMatch(provided, expected);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  if (!isAuthorized(req)) {
    // Deliberately generic — never confirms/denies whether a header was
    // present at all, let alone how close a wrong value was.
    return json({ error: 'Unauthorized.' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const {
    productId: rawProductId,
    description: rawDescription,
    material: rawMaterial,
    sizeChart: rawSizeChart,
    imageUrls: rawImageUrls,
  } = (body ?? {}) as {
    productId?: unknown;
    description?: unknown;
    material?: unknown;
    sizeChart?: unknown;
    imageUrls?: unknown;
  };

  // Same float-precision id-collision reasoning as curate-match's
  // productIds check: `products.id` is a Postgres bigint, far beyond what a
  // JS number can represent exactly once above 2^53-1, so an id above that
  // has already silently lost precision by the time it reaches here.
  if (
    typeof rawProductId !== 'number' ||
    !Number.isInteger(rawProductId) ||
    rawProductId <= 0 ||
    rawProductId > Number.MAX_SAFE_INTEGER
  ) {
    return json({ error: '`productId` must be a positive integer no greater than Number.MAX_SAFE_INTEGER.' }, 400);
  }
  const productId = rawProductId;

  const noOptionalFieldsProvided =
    rawDescription === undefined &&
    rawMaterial === undefined &&
    rawSizeChart === undefined &&
    rawImageUrls === undefined;
  if (noOptionalFieldsProvided) {
    return json(
      { error: 'At least one of `description`, `material`, `sizeChart`, `imageUrls` must be provided — nothing to update.' },
      400,
    );
  }

  let description: string | undefined;
  if (rawDescription !== undefined) {
    if (typeof rawDescription !== 'string') {
      return json({ error: '`description` must be a string.' }, 400);
    }
    if (rawDescription.length > MAX_DESCRIPTION_LENGTH) {
      return json({ error: `\`description\` too long — max ${MAX_DESCRIPTION_LENGTH} characters.` }, 400);
    }
    description = rawDescription;
  }

  let material: string | undefined;
  if (rawMaterial !== undefined) {
    if (typeof rawMaterial !== 'string') {
      return json({ error: '`material` must be a string.' }, 400);
    }
    if (rawMaterial.length > MAX_SHORT_FIELD_LENGTH) {
      return json({ error: `\`material\` too long — max ${MAX_SHORT_FIELD_LENGTH} characters.` }, 400);
    }
    material = rawMaterial;
  }

  let sizeChart: Record<string, unknown> | undefined;
  if (rawSizeChart !== undefined) {
    if (!isPlainObject(rawSizeChart)) {
      return json({ error: '`sizeChart` must be a JSON object (not an array, string, number, or null).' }, 400);
    }
    let serializedLength: number;
    try {
      serializedLength = JSON.stringify(rawSizeChart).length;
    } catch {
      return json({ error: '`sizeChart` could not be serialized — it must be plain JSON-safe data.' }, 400);
    }
    if (serializedLength > MAX_SIZE_CHART_JSON_LENGTH) {
      return json({ error: `\`sizeChart\` too large — serialized JSON must be at most ${MAX_SIZE_CHART_JSON_LENGTH} characters.` }, 400);
    }
    sizeChart = rawSizeChart;
  }

  let imageUrls: string[] | undefined;
  if (rawImageUrls !== undefined) {
    if (!Array.isArray(rawImageUrls)) {
      return json({ error: '`imageUrls` must be an array of strings.' }, 400);
    }
    if (rawImageUrls.length > MAX_IMAGE_URLS) {
      return json({ error: `\`imageUrls\` must contain at most ${MAX_IMAGE_URLS} URLs.` }, 400);
    }
    const notAString = rawImageUrls.find((url) => typeof url !== 'string');
    if (notAString !== undefined) {
      return json({ error: '`imageUrls` must contain only strings.' }, 400);
    }
    const tooLong = (rawImageUrls as string[]).find((url) => url.length > MAX_IMAGE_URL_LENGTH);
    if (tooLong !== undefined) {
      return json({ error: `\`imageUrls\` contains a URL longer than ${MAX_IMAGE_URL_LENGTH} characters.` }, 400);
    }
    // Per-store allowlist enforcement (isAllowedMarketplaceUrl) needs the
    // product's own `store` column from the DB — that happens in
    // updateProduct.ts, not here.
    imageUrls = rawImageUrls as string[];
  }

  try {
    const result = await updateProduct(supabaseAdmin, { productId, description, material, sizeChart, imageUrls });
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }
    return json({ productId: result.productId, updated: result.updated }, 200);
  } catch (err) {
    // updateProduct is documented to never throw (every DB call is checked
    // for `error` and turned into an UpdateProductFailure) — this is
    // defense in depth only, matching curate-match/index.ts's own top-level
    // catch.
    console.error('[curate-product] unhandled error updating product:', err);
    return json({ error: 'Failed to update the product unexpectedly. Nothing was saved.' }, 500);
  }
});
