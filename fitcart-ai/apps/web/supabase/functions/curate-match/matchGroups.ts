// DB-touching core of curate-match, extracted out of index.ts so it can be
// exercised against a fake Supabase client (no real DB) in matchGroups.test.ts
// — the same split search-products uses (cacheFirstSearch.ts / localCatalog.ts
// hold the DB-touching logic; index.ts only does synchronous request
// validation before calling in). index.ts's Deno.serve handler validates the
// request body, then calls createMatchGroup and maps its result to a
// Response.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CreateMatchGroupInput {
  productIds: number[];
  label: string;
  createdBy: string;
}

export interface CreateMatchGroupSuccess {
  ok: true;
  id: number;
  label: string;
  createdBy: string;
  productIds: number[];
}

export interface CreateMatchGroupFailure {
  ok: false;
  status: 400 | 500;
  error: string;
}

export type CreateMatchGroupResult = CreateMatchGroupSuccess | CreateMatchGroupFailure;

interface ProductIdRow {
  id: number;
}

interface MembershipRow {
  product_id: number;
  match_group_id: number;
}

interface GroupLabelRow {
  id: number;
  label: string;
}

interface GroupInsertRow {
  id: number;
  label: string;
  created_by: string;
}

// Postgres error code for a unique-violation — raised by product_id's
// `unique` constraint on product_match_members (schema.sql) when the member
// INSERT below tries to add a product that some other, concurrent request
// already committed to a different group. This is the authoritative guard
// against the "product already in another group" race: the pre-check further
// down (step 2) is only a same-request-timeline fast path and cannot, by
// itself, close a race between two concurrent requests that both read
// "no conflict" before either writes — only a DB-level constraint checked at
// INSERT time can. See schema.sql's comment on product_match_members for the
// full race description.
const POSTGRES_UNIQUE_VIOLATION = '23505';

// Creates one product_match_groups row plus one product_match_members row
// per productId, as one logical operation. Every step is a real DB check —
// nothing here is assumed true just because the caller claimed it:
//   1. every productId must already exist in `products`.
//   2. no productId may already belong to another match group (a product in
//      two groups at once is a real data-integrity problem — which group
//      would the frontend show? — so this is a hard rejection, never a
//      silent duplicate/overwrite). This is checked twice: an app-layer
//      SELECT here (fast path, gives a clean/specific error in the common
//      case) AND, authoritatively, by product_match_members.product_id's DB
//      `unique` constraint at INSERT time (step 3) — the SELECT alone has a
//      TOCTOU race window between two concurrent requests that the DB
//      constraint closes.
//   3. the group row and its member rows are created together; if the
//      member insert fails after the group row was created (there is no
//      client-side multi-table transaction primitive available here), the
//      group row is deleted again before returning, so a failed request
//      never leaves an orphaned/empty group behind. If even that cleanup
//      fails, this says so explicitly rather than claiming a clean rollback
//      that didn't happen. A unique-violation (23505) on this insert — i.e.
//      the race the step-2 SELECT couldn't fully close — is reported as the
//      same clean 400 the pre-check gives, not a generic 500, since it's the
//      same user-facing condition just caught at a different layer.
export async function createMatchGroup(
  supabaseAdmin: SupabaseClient,
  input: CreateMatchGroupInput,
): Promise<CreateMatchGroupResult> {
  const { productIds, label, createdBy } = input;

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('products')
    .select('id')
    .in('id', productIds);

  if (existingError) {
    console.error('[curate-match] failed to verify product ids exist:', existingError);
    return { ok: false, status: 500, error: 'Could not verify the given product ids against the catalog. Try again.' };
  }

  const existingIds = new Set(((existingRows ?? []) as ProductIdRow[]).map((r) => r.id));
  const missingIds = productIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Unknown product id(s): ${missingIds.join(', ')}. Every id must already exist in the catalog.`,
    };
  }

  const { data: conflictRows, error: conflictError } = await supabaseAdmin
    .from('product_match_members')
    .select('product_id, match_group_id')
    .in('product_id', productIds);

  if (conflictError) {
    console.error('[curate-match] failed to check for existing match-group membership:', conflictError);
    return { ok: false, status: 500, error: 'Could not verify existing match-group membership. Try again.' };
  }

  const memberships = (conflictRows ?? []) as MembershipRow[];
  if (memberships.length > 0) {
    const conflictingGroupIds = [...new Set(memberships.map((m) => m.match_group_id))];
    const { data: groupRows, error: groupsError } = await supabaseAdmin
      .from('product_match_groups')
      .select('id, label')
      .in('id', conflictingGroupIds);

    if (groupsError) {
      console.error('[curate-match] failed to look up conflicting match group labels:', groupsError);
      return { ok: false, status: 500, error: 'Could not verify existing match-group membership. Try again.' };
    }

    const labelById = new Map(((groupRows ?? []) as GroupLabelRow[]).map((g) => [g.id, g.label]));
    const conflictDescriptions = memberships
      .map((m) => `product ${m.product_id} is already in match group ${m.match_group_id} ("${labelById.get(m.match_group_id) ?? 'unknown'}")`)
      .join('; ');
    return {
      ok: false,
      status: 400,
      error: `Cannot create group — ${conflictDescriptions}. A product may only belong to one match group.`,
    };
  }

  const { data: groupRow, error: groupInsertError } = await supabaseAdmin
    .from('product_match_groups')
    .insert({ label, created_by: createdBy })
    .select('id, label, created_by')
    .single();

  if (groupInsertError || !groupRow) {
    console.error('[curate-match] failed to create match group:', groupInsertError);
    return { ok: false, status: 500, error: 'Failed to create the match group. Nothing was saved.' };
  }
  const createdGroup = groupRow as GroupInsertRow;

  const { error: memberInsertError } = await supabaseAdmin
    .from('product_match_members')
    .insert(productIds.map((productId) => ({ match_group_id: createdGroup.id, product_id: productId })));

  if (memberInsertError) {
    console.error('[curate-match] failed to add members to match group, rolling back:', memberInsertError);
    const { error: cleanupError } = await supabaseAdmin.from('product_match_groups').delete().eq('id', createdGroup.id);
    if (cleanupError) {
      // Worst case: say so plainly rather than claim a clean rollback that
      // didn't actually happen — an orphaned empty group is a real bug to
      // go clean up by hand, not something to hide from the caller.
      console.error('[curate-match] rollback of orphaned match group failed:', cleanupError);
      return {
        ok: false,
        status: 500,
        error: `Failed to add members to the match group, and automatic cleanup also failed — match group ${createdGroup.id} may now exist with no members. Needs manual cleanup.`,
      };
    }

    // A 23505 unique-violation here means product_match_members.product_id's
    // DB constraint just caught a losing race: some other, concurrent
    // request committed one of these productIds to a different group between
    // this request's step-2 pre-check and this INSERT. The group row has
    // already been rolled back above — report the same clean, specific 400
    // the pre-check gives for this exact condition, not a generic 500, since
    // that's the true, user-facing cause.
    if ((memberInsertError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
      return {
        ok: false,
        status: 400,
        error: 'Cannot create group — one or more of these products is already in another match group (added by a concurrent request just now). A product may only belong to one match group. Please retry.',
      };
    }

    return {
      ok: false,
      status: 500,
      error: 'Failed to add members to the match group. The group was rolled back — nothing was saved.',
    };
  }

  return { ok: true, id: createdGroup.id, label: createdGroup.label, createdBy: createdGroup.created_by, productIds };
}
