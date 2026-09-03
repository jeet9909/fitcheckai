// Exercises createMatchGroup against a fake Supabase client (no real DB) —
// same tailored-fake-per-test convention as search-products' localCatalog.
// test.ts / cacheFirstSearch.test.ts. Covers: unknown product id rejection,
// the "already in another group" rejection (with group id + label in the
// message), the happy path's two inserts, the rollback-on-partial-failure
// behavior (including the "cleanup itself also failed" edge case), and the
// DB-level 23505 unique-violation path that catches the TOCTOU race the
// app-layer pre-check alone can't close (see schema.sql's comment on
// product_match_members.product_id for the full race description).

import { assert, assertEquals } from '../search-products/_testUtils.ts';
import { createMatchGroup } from './matchGroups.ts';

interface Membership {
  product_id: number;
  match_group_id: number;
}

interface GroupLabel {
  id: number;
  label: string;
}

interface FakeOptions {
  existingProductIds?: number[];
  productsError?: boolean;
  memberships?: Membership[];
  membersError?: boolean;
  groupLabels?: GroupLabel[];
  groupsSelectError?: boolean;
  nextGroupId?: number;
  groupInsertError?: boolean;
  memberInsertError?: boolean;
  // Simulates the DB-level unique-violation (Postgres 23505) raised by
  // product_match_members.product_id's `unique` constraint (schema.sql) —
  // i.e. a losing TOCTOU race where a concurrent request committed one of
  // these productIds to a different group *after* this request's app-layer
  // pre-check (the `memberships` option above) already passed. Distinct from
  // the generic `memberInsertError` above so tests can assert this specific
  // error is mapped to the same clean 400 the pre-check itself gives,
  // instead of the generic 500 a non-23505 insert failure gets.
  memberInsertUniqueViolation?: boolean;
  groupDeleteError?: boolean;
}

interface RecordedCalls {
  insertGroup: { label: string; created_by: string }[];
  insertMembers: { match_group_id: number; product_id: number }[][];
  deleteGroup: number[];
}

// deno-lint-ignore no-explicit-any
function createFakeSupabase(opts: FakeOptions): { client: any; calls: RecordedCalls } {
  const existingProductIds = new Set(opts.existingProductIds ?? []);
  const memberships = opts.memberships ?? [];
  const groupLabels = opts.groupLabels ?? [];
  const nextGroupId = opts.nextGroupId ?? 101;
  const calls: RecordedCalls = { insertGroup: [], insertMembers: [], deleteGroup: [] };

  const client = {
    from(table: string) {
      if (table === 'products') {
        return {
          select(_cols: string) {
            return {
              in(_col: string, ids: number[]) {
                if (opts.productsError) return Promise.resolve({ data: null, error: { message: 'boom' } });
                return Promise.resolve({ data: ids.filter((id) => existingProductIds.has(id)).map((id) => ({ id })), error: null });
              },
            };
          },
        };
      }

      if (table === 'product_match_members') {
        return {
          select(_cols: string) {
            return {
              in(_col: string, ids: number[]) {
                if (opts.membersError) return Promise.resolve({ data: null, error: { message: 'boom' } });
                return Promise.resolve({ data: memberships.filter((m) => ids.includes(m.product_id)), error: null });
              },
            };
          },
          insert(rows: { match_group_id: number; product_id: number }[]) {
            calls.insertMembers.push(rows);
            if (opts.memberInsertUniqueViolation) {
              return Promise.resolve({ error: { message: 'duplicate key value violates unique constraint "product_match_members_product_id_key"', code: '23505' } });
            }
            if (opts.memberInsertError) return Promise.resolve({ error: { message: 'boom' } });
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === 'product_match_groups') {
        return {
          select(_cols: string) {
            return {
              in(_col: string, ids: number[]) {
                if (opts.groupsSelectError) return Promise.resolve({ data: null, error: { message: 'boom' } });
                return Promise.resolve({ data: groupLabels.filter((g) => ids.includes(g.id)), error: null });
              },
            };
          },
          insert(row: { label: string; created_by: string }) {
            calls.insertGroup.push(row);
            return {
              select(_cols: string) {
                return {
                  single() {
                    if (opts.groupInsertError) return Promise.resolve({ data: null, error: { message: 'boom' } });
                    return Promise.resolve({ data: { id: nextGroupId, label: row.label, created_by: row.created_by }, error: null });
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(_col: string, id: number) {
                calls.deleteGroup.push(id);
                if (opts.groupDeleteError) return Promise.resolve({ error: { message: 'boom' } });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error(`createFakeSupabase: unexpected table "${table}"`);
    },
  };

  return { client, calls };
}

Deno.test('createMatchGroup: happy path creates the group then inserts one member row per productId', async () => {
  const { client, calls } = createFakeSupabase({ existingProductIds: [1, 2, 3], nextGroupId: 55 });

  const result = await createMatchGroup(client, { productIds: [1, 2, 3], label: "Levi's 511 Slim Jeans, Indigo", createdBy: 'curator@fitcartai.com' });

  assert(result.ok, 'expected success');
  if (result.ok) {
    assertEquals(result.id, 55);
    assertEquals(result.label, "Levi's 511 Slim Jeans, Indigo");
    assertEquals(result.createdBy, 'curator@fitcartai.com');
    assertEquals(result.productIds, [1, 2, 3]);
  }
  assertEquals(calls.insertGroup.length, 1);
  assertEquals(calls.insertGroup[0], { label: "Levi's 511 Slim Jeans, Indigo", created_by: 'curator@fitcartai.com' });
  assertEquals(calls.insertMembers.length, 1);
  assertEquals(calls.insertMembers[0], [
    { match_group_id: 55, product_id: 1 },
    { match_group_id: 55, product_id: 2 },
    { match_group_id: 55, product_id: 3 },
  ]);
  assertEquals(calls.deleteGroup.length, 0, 'no rollback expected on the happy path');
});

Deno.test('createMatchGroup: rejects with 400 when a productId does not exist in `products`, without ever inserting a group', async () => {
  const { client, calls } = createFakeSupabase({ existingProductIds: [1, 2] });

  const result = await createMatchGroup(client, { productIds: [1, 2, 999], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assert(result.error.includes('999'), `expected error to mention the missing id, got: ${result.error}`);
  }
  assertEquals(calls.insertGroup.length, 0, 'must not create a group when a referenced product id does not exist');
});

Deno.test('createMatchGroup: a DB error while verifying product ids is a 500, never silently treated as "all missing" or "all present"', async () => {
  const { client, calls } = createFakeSupabase({ productsError: true });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) assertEquals(result.status, 500);
  assertEquals(calls.insertGroup.length, 0);
});

Deno.test('createMatchGroup: rejects with 400 when a productId already belongs to another match group, naming the group id and label', async () => {
  const { client, calls } = createFakeSupabase({
    existingProductIds: [1, 2],
    memberships: [{ product_id: 2, match_group_id: 7 }],
    groupLabels: [{ id: 7, label: 'Existing Group Label' }],
  });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'New Group', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assert(result.error.includes('product 2'), result.error);
    assertEquals(result.error.includes('match group 7'), true);
    assertEquals(result.error.includes('Existing Group Label'), true);
  }
  assertEquals(calls.insertGroup.length, 0, 'must not create a second group for an already-matched product');
});

Deno.test('createMatchGroup: a DB error while checking membership conflicts is a 500', async () => {
  const { client } = createFakeSupabase({ existingProductIds: [1, 2], membersError: true });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) assertEquals(result.status, 500);
});

Deno.test('createMatchGroup: a DB error while looking up a conflicting group\'s label is a 500', async () => {
  const { client } = createFakeSupabase({
    existingProductIds: [1, 2],
    memberships: [{ product_id: 2, match_group_id: 7 }],
    groupsSelectError: true,
  });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) assertEquals(result.status, 500);
});

Deno.test('createMatchGroup: a failed group insert is a 500 and never attempts the member insert', async () => {
  const { client, calls } = createFakeSupabase({ existingProductIds: [1, 2], groupInsertError: true });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) assertEquals(result.status, 500);
  assertEquals(calls.insertMembers.length, 0);
});

Deno.test('createMatchGroup: a failed member insert rolls back (deletes) the just-created group and reports a clean-rollback 500', async () => {
  const { client, calls } = createFakeSupabase({ existingProductIds: [1, 2], nextGroupId: 42, memberInsertError: true });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 500);
    assert(result.error.toLowerCase().includes('rolled back'), result.error);
  }
  assertEquals(calls.deleteGroup, [42], 'expected the orphaned group row to be deleted');
});

Deno.test('createMatchGroup: a 23505 unique-violation on the member insert (a losing TOCTOU race the pre-check missed) is treated as the same clean "already in another group" 400, with the group rolled back', async () => {
  // Simulates two concurrent requests racing over an overlapping productId:
  // this fake's pre-check (the `memberships` select) reports no conflict —
  // as it would for a request that read state before the other request's
  // write landed — so createMatchGroup proceeds past step 2 exactly like the
  // happy path. Only the member INSERT itself (step 3, the DB-level
  // authoritative guard) reports the unique-violation, standing in for the
  // other request having committed its own membership row for one of these
  // productIds in between.
  const { client, calls } = createFakeSupabase({
    existingProductIds: [1, 2],
    memberships: [], // pre-check finds nothing — this is the race window
    nextGroupId: 42,
    memberInsertUniqueViolation: true,
  });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok, 'expected the race to be caught at insert time, not silently succeed');
  if (!result.ok) {
    // Same 400 shape/status the app-layer pre-check gives for this exact
    // condition — never the generic 500 a non-23505 insert failure gets.
    assertEquals(result.status, 400);
    assert(result.error.toLowerCase().includes('already'), result.error);
    assert(result.error.toLowerCase().includes('match group'), result.error);
  }
  // The group row created before the race was detected must still be rolled
  // back — a losing race must never leave an orphaned group behind, exactly
  // like any other member-insert failure.
  assertEquals(calls.deleteGroup, [42], 'expected the orphaned group row to be rolled back after the 23505');
});

Deno.test('createMatchGroup: when the member insert AND the rollback delete both fail, the response says so explicitly (never claims a clean rollback)', async () => {
  const { client, calls } = createFakeSupabase({
    existingProductIds: [1, 2],
    nextGroupId: 42,
    memberInsertError: true,
    groupDeleteError: true,
  });

  const result = await createMatchGroup(client, { productIds: [1, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 500);
    assert(result.error.includes('42'), result.error);
    assert(result.error.toLowerCase().includes('manual cleanup'), result.error);
  }
  assertEquals(calls.deleteGroup, [42]);
});
