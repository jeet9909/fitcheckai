// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy curate-match
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// CURATE_MATCH_SECRET (a random server-to-server secret — see
// supabase/README.md for how to generate/set it). Deliberately its own
// secret, not a reuse of POPULATE_CATALOG_SECRET: this is a distinct admin
// capability, and rotating/revoking one must never affect the other.
//
// Manual curation only — this is NOT automated cross-store matching. An
// earlier design considered scoring product title/image similarity to
// auto-suggest "this is probably the same item on another store"; that was
// explicitly rejected as unreliable for this catalog — a false match
// (silently showing two different products as "the same item, cheaper
// elsewhere") is actively misleading to a shopper, worse than showing no
// comparison at all (D-014: never present data as more/less trustworthy
// than it actually is). This function only ever records the exact product
// id list a human curator submitted in the request body — no title
// matching, no image hashing, no fuzzy/similarity scoring anywhere in this
// function or matchGroups.ts.
//
// Security: POST-only, requires a matching `x-curate-match-secret` request
// header — same constant-time-comparison pattern as populate-catalog's
// `x-populate-secret` (see secretsMatch below). 401 (no detail leaked about
// what's missing/wrong) on failure. Server-to-server admin operation only —
// no frontend code knows this secret.
//
// Request body: { productIds: number[], label: string, createdBy: string }
//   - `productIds`: MIN_GROUP_SIZE..MAX_GROUP_SIZE distinct positive
//     integers. Every id must already exist in `products` (checked against
//     the DB in matchGroups.ts, never assumed) and must not already belong
//     to another match group (also checked against the DB) — a product in
//     two groups at once is a real data-integrity problem, so that's a hard
//     400, not silently allowed.
//   - `label`: non-empty human-readable description of the matched item
//     (e.g. "Levi's 511 Slim Jeans, Indigo"), capped at MAX_LABEL_LENGTH.
//   - `createdBy`: non-empty free-text curator identity (e.g. an email) for
//     accountability. No auth-system integration for v1 — trusted as given
//     once the shared secret has authorized the request, the same trust
//     boundary populate-catalog uses for its own caller.
//
// Response: 200 with { id, label, createdBy, productIds } for the newly
// created group. Every validation/integrity failure is a specific 400
// (unknown product id, wrong productIds count/shape, product already in
// another group, missing/empty/too-long label or createdBy) — never a vague
// "something went wrong". The group row + its member rows are created as
// one logical operation — see matchGroups.ts's createMatchGroup for the
// rollback-on-partial-failure behavior when there's no client-side
// multi-table transaction available.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createMatchGroup } from './matchGroups.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-curate-match-secret',
};

const MIN_GROUP_SIZE = 2;
const MAX_GROUP_SIZE = 10;
const MAX_LABEL_LENGTH = 200;
const MAX_CREATED_BY_LENGTH = 200;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Same constant-time-ish comparison as populate-catalog/index.ts's
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
  const expected = Deno.env.get('CURATE_MATCH_SECRET') ?? '';
  const provided = req.headers.get('x-curate-match-secret') ?? '';
  // An unset server-side secret must never be treated as "no secret
  // required" — an empty `expected` can only ever match an empty
  // `provided`, and an empty header is already excluded by requiring both
  // to be non-empty first.
  if (!expected || !provided) return false;
  return secretsMatch(provided, expected);
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

  const { productIds: rawProductIds, label: rawLabel, createdBy: rawCreatedBy } = (body ?? {}) as {
    productIds?: unknown;
    label?: unknown;
    createdBy?: unknown;
  };

  if (!Array.isArray(rawProductIds)) {
    return json({ error: '`productIds` must be an array of product ids.' }, 400);
  }
  // Upper-bounded at Number.MAX_SAFE_INTEGER (2^53 - 1): `products.id` is a
  // Postgres `bigint` (max ~9.2e18), far beyond what a JS `number` can
  // represent exactly, but a request body only ever reaches here as
  // already-parsed JSON — by the time `Number.isInteger` sees it, any id
  // above 2^53-1 has already silently lost precision to float rounding and
  // may no longer match the real id the caller meant. Rejecting those here
  // (rather than only bounding `> 0`) stops a malformed/malicious huge id
  // from round-tripping as some other, unrelated real bigint product id
  // after JSON transit to Postgres.
  const notPositiveInt = rawProductIds.find(
    (id) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER,
  );
  if (notPositiveInt !== undefined) {
    return json({ error: '`productIds` must contain only positive integers no greater than Number.MAX_SAFE_INTEGER.' }, 400);
  }
  const productIds = rawProductIds as number[];

  if (new Set(productIds).size !== productIds.length) {
    return json({ error: '`productIds` contains duplicate ids — each product may only appear once in the list.' }, 400);
  }
  if (productIds.length < MIN_GROUP_SIZE) {
    return json(
      { error: `\`productIds\` must contain at least ${MIN_GROUP_SIZE} ids — a match group of one product is meaningless.` },
      400,
    );
  }
  if (productIds.length > MAX_GROUP_SIZE) {
    return json({ error: `\`productIds\` must contain at most ${MAX_GROUP_SIZE} ids per group. Split into multiple groups.` }, 400);
  }

  if (typeof rawLabel !== 'string' || rawLabel.trim().length === 0) {
    return json({ error: '`label` must be a non-empty string.' }, 400);
  }
  const label = rawLabel.trim();
  if (label.length > MAX_LABEL_LENGTH) {
    return json({ error: `\`label\` too long — max ${MAX_LABEL_LENGTH} characters.` }, 400);
  }

  if (typeof rawCreatedBy !== 'string' || rawCreatedBy.trim().length === 0) {
    return json({ error: '`createdBy` must be a non-empty string.' }, 400);
  }
  const createdBy = rawCreatedBy.trim();
  if (createdBy.length > MAX_CREATED_BY_LENGTH) {
    return json({ error: `\`createdBy\` too long — max ${MAX_CREATED_BY_LENGTH} characters.` }, 400);
  }

  try {
    const result = await createMatchGroup(supabaseAdmin, { productIds, label, createdBy });
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }
    return json({ id: result.id, label: result.label, createdBy: result.createdBy, productIds: result.productIds }, 200);
  } catch (err) {
    // createMatchGroup is documented to never throw (every DB call is
    // checked for `error` and turned into a CreateMatchGroupFailure) — this
    // is defense in depth only, matching populate-catalog/index.ts's own
    // top-level catch.
    console.error('[curate-match] unhandled error creating match group:', err);
    return json({ error: 'Failed to create the match group unexpectedly. Nothing was saved.' }, 500);
  }
});
