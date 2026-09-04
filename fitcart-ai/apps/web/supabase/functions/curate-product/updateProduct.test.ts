// Exercises updateProduct against a fake Supabase client (no real DB) —
// same tailored-fake-per-test convention as curate-match's
// matchGroups.test.ts / search-products' localCatalog.test.ts. Covers: the
// happy path's real partial update (only the provided fields reach the
// UPDATE payload, nothing else is touched), unknown productId, a DB error
// looking up the product, a disallowed image URL for the product's own
// store, an unrecognized store blocking any imageUrls update, a DB error on
// the UPDATE itself, that the UPDATE is scoped by both `id` and `store` (the
// TOCTOU guard), and that a zero-rows-affected UPDATE (the row's `store`
// changed between the SELECT and the UPDATE) is reported as a clean 400
// conflict rather than a false success.

import { assert, assertEquals } from '../search-products/_testUtils.ts';
import { updateProduct } from './updateProduct.ts';

interface FakeOptions {
  product?: { id: number; store: string } | null;
  lookupError?: boolean;
  updateError?: boolean;
  // Simulates the row's `store` having changed between the SELECT and the
  // UPDATE (a concurrent re-scrape): the `.eq('store', ...)` on the UPDATE
  // then matches zero rows, so PostgREST's `.select('id')` representation
  // comes back empty even though there was no hard `error`.
  updateAffectsZeroRows?: boolean;
}

interface RecordedCalls {
  update: Record<string, unknown>[];
  // Each entry is the sequence of `.eq(col, value)` calls chained onto that
  // particular `.update()` call, in call order — lets tests assert the fix
  // actually filters on both `id` *and* `store`, not just `id`.
  updateEqs: Array<Array<[string, unknown]>>;
}

// deno-lint-ignore no-explicit-any
function createFakeSupabase(opts: FakeOptions): { client: any; calls: RecordedCalls } {
  const calls: RecordedCalls = { update: [], updateEqs: [] };

  const client = {
    from(table: string) {
      if (table !== 'products') {
        throw new Error(`createFakeSupabase: unexpected table "${table}"`);
      }
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _id: number) {
              return {
                maybeSingle() {
                  if (opts.lookupError) return Promise.resolve({ data: null, error: { message: 'boom' } });
                  return Promise.resolve({ data: opts.product ?? null, error: null });
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          calls.update.push(payload);
          const eqsForThisCall: Array<[string, unknown]> = [];
          calls.updateEqs.push(eqsForThisCall);
          const builder = {
            eq(col: string, value: unknown) {
              eqsForThisCall.push([col, value]);
              return builder;
            },
            select(_cols: string) {
              if (opts.updateError) return Promise.resolve({ data: null, error: { message: 'boom' } });
              if (opts.updateAffectsZeroRows) return Promise.resolve({ data: [], error: null });
              return Promise.resolve({ data: [{ id: eqsForThisCall.find(([c]) => c === 'id')?.[1] }], error: null });
            },
          };
          return builder;
        },
      };
    },
  };

  return { client, calls };
}

Deno.test('updateProduct: happy path — a partial update (only `description`) touches only that column in the UPDATE payload', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 1, store: 'Amazon' } });

  const result = await updateProduct(client, { productId: 1, description: 'A soft cotton shirt.' });

  assert(result.ok, 'expected success');
  if (result.ok) {
    assertEquals(result.productId, 1);
    assertEquals(result.updated, { description: 'A soft cotton shirt.' });
  }
  assertEquals(calls.update.length, 1);
  assertEquals(calls.update[0], { description: 'A soft cotton shirt.' });
});

Deno.test('updateProduct: happy path — multiple provided fields (material + sizeChart) all reach the UPDATE payload with correct column names', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 2, store: 'Myntra' } });

  const sizeChart = { chest: '38-40', waist: '32-34' };
  const result = await updateProduct(client, { productId: 2, material: 'Cotton', sizeChart });

  assert(result.ok, 'expected success');
  if (result.ok) {
    assertEquals(result.updated, { material: 'Cotton', sizeChart });
  }
  assertEquals(calls.update[0], { material: 'Cotton', size_chart: sizeChart });
});

// `color` is deliberately NOT part of UpdateProductInput/UpdateProductFields
// (see index.ts's header comment: a curator-set `color` value would be
// silently reverted by the next scrape-driven upsert in
// search-products/persistCatalog.ts). Regression guard: even if a caller
// passes an extraneous `color` property on the input object (TypeScript
// wouldn't allow this from typed call sites, but the function must still be
// safe against a loosely-typed/`any` caller — e.g. a future refactor of
// index.ts), it must never reach the UPDATE payload.
Deno.test('updateProduct: an extraneous `color` property on the input is never written to the UPDATE payload', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 10, store: 'Amazon' } });

  // deno-lint-ignore no-explicit-any
  const inputWithColor: any = { productId: 10, material: 'Silk', color: 'Navy' };
  const result = await updateProduct(client, inputWithColor);

  assert(result.ok, 'expected success');
  if (result.ok) {
    assert(!('color' in result.updated), 'color must never be echoed back as updated');
  }
  assertEquals(calls.update[0], { material: 'Silk' });
  assert(!('color' in calls.update[0]), 'color must never reach the UPDATE payload');
});

Deno.test('updateProduct: happy path — valid `imageUrls` allowlisted for the product\'s store reach the UPDATE payload as `image_urls`', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 3, store: 'Amazon' } });

  const imageUrls = ['https://images.amazon.in/I/one.jpg', 'https://images.amazon.in/I/two.jpg'];
  const result = await updateProduct(client, { productId: 3, imageUrls });

  assert(result.ok, 'expected success');
  if (result.ok) assertEquals(result.updated, { imageUrls });
  assertEquals(calls.update[0], { image_urls: imageUrls });
});

Deno.test('updateProduct: rejects with 400 for an unknown productId, without ever calling update', async () => {
  const { client, calls } = createFakeSupabase({ product: null });

  const result = await updateProduct(client, { productId: 999, description: 'x' });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assert(result.error.includes('999'), result.error);
  }
  assertEquals(calls.update.length, 0);
});

Deno.test('updateProduct: a DB error while looking up the product is a 500, never silently treated as "not found"', async () => {
  const { client, calls } = createFakeSupabase({ lookupError: true });

  const result = await updateProduct(client, { productId: 1, description: 'x' });

  assert(!result.ok);
  if (!result.ok) assertEquals(result.status, 500);
  assertEquals(calls.update.length, 0);
});

Deno.test('updateProduct: rejects with 400 when an `imageUrls` entry is not allowlisted for the product\'s own store, naming the URL', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 4, store: 'Amazon' } });

  const result = await updateProduct(client, {
    productId: 4,
    imageUrls: ['https://images.amazon.in/I/ok.jpg', 'https://evil.example.com/phish.jpg'],
  });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assert(result.error.includes('evil.example.com/phish.jpg'), result.error);
    assert(result.error.includes('Amazon'), result.error);
  }
  assertEquals(calls.update.length, 0, 'must not run any update if any image URL fails the allowlist');
});

Deno.test('updateProduct: rejects with 400 when `imageUrls` is provided for a product whose store isn\'t a recognized marketplace', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 5, store: 'SomeUnknownStore' } });

  const result = await updateProduct(client, { productId: 5, imageUrls: ['https://example.com/img.jpg'] });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assert(result.error.includes('SomeUnknownStore'), result.error);
  }
  assertEquals(calls.update.length, 0);
});

Deno.test('updateProduct: a product with an unrecognized store can still have non-imageUrls fields updated', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 6, store: 'SomeUnknownStore' } });

  const result = await updateProduct(client, { productId: 6, description: 'Still fine to update prose fields.' });

  assert(result.ok, 'expected success — only imageUrls needs a recognized store');
  assertEquals(calls.update[0], { description: 'Still fine to update prose fields.' });
});

Deno.test('updateProduct: a DB error on the UPDATE itself is a 500 with a generic message', async () => {
  const { client } = createFakeSupabase({ product: { id: 7, store: 'Flipkart' }, updateError: true });

  const result = await updateProduct(client, { productId: 7, description: 'x' });

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 500);
    // Generic — never leaks the raw DB error string.
    assert(!result.error.includes('boom'), result.error);
  }
});

Deno.test('updateProduct: filters the UPDATE by both `id` and the just-looked-up `store` (TOCTOU guard)', async () => {
  const { client, calls } = createFakeSupabase({ product: { id: 8, store: 'Nykaa Fashion' } });

  const result = await updateProduct(client, { productId: 8, description: 'x' });

  assert(result.ok, 'expected success');
  assertEquals(calls.updateEqs.length, 1);
  assertEquals(calls.updateEqs[0], [
    ['id', 8],
    ['store', 'Nykaa Fashion'],
  ]);
});

Deno.test('updateProduct: a store change between the SELECT and the UPDATE (zero rows affected) is a clean 400 conflict, never a silent success', async () => {
  const { client, calls } = createFakeSupabase({
    product: { id: 9, store: 'Amazon' },
    updateAffectsZeroRows: true,
  });

  const result = await updateProduct(client, {
    productId: 9,
    imageUrls: ['https://images.amazon.in/I/one.jpg'],
  });

  assert(!result.ok, 'must never report success when the UPDATE matched zero rows');
  if (!result.ok) {
    assertEquals(result.status, 400);
    assert(result.error.includes('9'), result.error);
    assert(result.error.includes('Amazon'), result.error);
    assert(result.error.toLowerCase().includes('retry'), result.error);
  }
  // The UPDATE was still attempted (and correctly scoped to id + store) —
  // this isn't a case where the function should have skipped the write
  // entirely, only one where it must not claim the write succeeded.
  assertEquals(calls.update.length, 1);
});
