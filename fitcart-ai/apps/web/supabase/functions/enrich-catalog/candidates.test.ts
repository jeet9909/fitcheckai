// Exercises selectCandidates against a fake Supabase client (no real DB) and
// enrichCandidate against a fake Supabase client + mocked globalThis.fetch
// (no real network) — same tailored-fake-per-test convention as
// curate-match's matchGroups.test.ts / curate-product's
// updateProduct.test.ts (DB) and search-products' scraping/*.test.ts
// (globalThis.fetch mocking). Covers: candidate selection's `force`
// filtering and store/limit wiring, and every enrichCandidate outcome
// (enriched, unsupported store, disallowed fetch target, 404/not_found,
// non-2xx scrape_blocked, network-error scrape_failed, unparseable-page
// scrape_blocked, parsed-but-nothing-new scrape_blocked, and a DB write
// failure mapped to scrape_failed) — see the comment above the
// "unexpected host after redirect" case below for the one branch this file
// deliberately does NOT attempt to fake, and why.

import { assert, assertEquals } from '../search-products/_testUtils.ts';
import { enrichCandidate, type EnrichItemResult, runEnrichmentLoop, selectCandidates } from './candidates.ts';
import { MAX_DESCRIPTION_LENGTH } from '../curate-product/updateProduct.ts';

// --- selectCandidates ---

interface FakeSelectOptions {
  rows?: { id: number; store: string; product_url: string | null }[];
  selectError?: boolean;
}

interface RecordedSelectCall {
  in: [string, unknown] | undefined;
  not: [string, string, unknown] | undefined;
  eqs: [string, unknown][];
  limit: number | undefined;
}

// deno-lint-ignore no-explicit-any
function createFakeSupabaseForSelect(opts: FakeSelectOptions): { client: any; call: RecordedSelectCall } {
  const rows = opts.rows ?? [];
  const call: RecordedSelectCall = { in: undefined, not: undefined, eqs: [], limit: undefined };

  const builder = {
    in(col: string, value: unknown) {
      call.in = [col, value];
      return builder;
    },
    not(col: string, op: string, value: unknown) {
      call.not = [col, op, value];
      return builder;
    },
    eq(col: string, value: unknown) {
      call.eqs.push([col, value]);
      return builder;
    },
    limit(n: number) {
      call.limit = n;
      if (opts.selectError) return Promise.resolve({ data: null, error: { message: 'boom' } });
      return Promise.resolve({ data: rows, error: null });
    },
  };

  const client = {
    from(table: string) {
      if (table !== 'products') throw new Error(`createFakeSupabaseForSelect: unexpected table "${table}"`);
      return { select: (_cols: string) => builder };
    },
  };

  return { client, call };
}

Deno.test('selectCandidates: happy path returns real candidate rows, filtered to those with a real product_url', async () => {
  const { client } = createFakeSupabaseForSelect({
    rows: [
      { id: 1, store: 'Amazon', product_url: 'https://www.amazon.in/dp/ONE' },
      { id: 2, store: 'Amazon', product_url: 'https://www.amazon.in/dp/TWO' },
    ],
  });

  const result = await selectCandidates(client, { stores: ['Amazon'], limit: 15, force: false });

  assert(result.ok, 'expected success');
  if (result.ok) {
    assertEquals(result.candidates.length, 2);
    assertEquals(result.candidates[0], { id: 1, store: 'Amazon', product_url: 'https://www.amazon.in/dp/ONE' });
  }
});

Deno.test('selectCandidates: force=false adds the "still at schema defaults" description/image_urls filter', async () => {
  const { client, call } = createFakeSupabaseForSelect({ rows: [] });

  await selectCandidates(client, { stores: ['Amazon'], limit: 15, force: false });

  assertEquals(call.eqs, [
    ['description', ''],
    ['image_urls', '{}'],
  ]);
});

Deno.test('selectCandidates: force=true skips the "still at schema defaults" filter entirely', async () => {
  const { client, call } = createFakeSupabaseForSelect({ rows: [] });

  await selectCandidates(client, { stores: ['Amazon'], limit: 15, force: true });

  assertEquals(call.eqs, []);
});

Deno.test('selectCandidates: wires `stores` into `.in()` and `limit` into `.limit()`', async () => {
  const { client, call } = createFakeSupabaseForSelect({ rows: [] });

  await selectCandidates(client, { stores: ['Amazon', 'Flipkart'], limit: 7, force: true });

  assertEquals(call.in, ['store', ['Amazon', 'Flipkart']]);
  assertEquals(call.limit, 7);
  assertEquals(call.not, ['product_url', 'is', null]);
});

Deno.test('selectCandidates: a DB error is a real failure, never silently treated as "zero candidates"', async () => {
  const { client } = createFakeSupabaseForSelect({ selectError: true });

  const result = await selectCandidates(client, { stores: ['Amazon'], limit: 15, force: false });

  assert(!result.ok);
  if (!result.ok) assert(!result.error.includes('boom'), 'must not leak the raw DB error');
});

// --- enrichCandidate ---

function withMockedFetch(handler: (url: string) => Response, fn: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(handler(url));
  }) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

interface FakeUpdateOptions {
  product?: { id: number; store: string };
  updateError?: boolean;
}

// deno-lint-ignore no-explicit-any
function createFakeSupabaseForUpdate(opts: FakeUpdateOptions): any {
  return {
    from(table: string) {
      if (table !== 'products') throw new Error(`createFakeSupabaseForUpdate: unexpected table "${table}"`);
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _id: number) {
              return { maybeSingle: () => Promise.resolve({ data: opts.product ?? null, error: null }) };
            },
          };
        },
        update(_payload: Record<string, unknown>) {
          const builder = {
            eq(_col: string, _value: unknown) {
              return builder;
            },
            select(_cols: string) {
              if (opts.updateError) return Promise.resolve({ data: null, error: { message: 'boom' } });
              return Promise.resolve({ data: [{ id: opts.product?.id }], error: null });
            },
          };
          return builder;
        },
      };
    },
  };
}

const AMAZON_PAGE_HTML = `
<html><body>
  <span id="productTitle">Men's Cotton Shirt</span>
  <span class="a-price-whole">799</span>
  <script>var x = {"colorImages":{"initial":[{"hiRes":"https://m.media-amazon.com/images/I/71ABC._SL1500_.jpg"}]}}</script>
</body></html>
`;

const AMAZON_PAGE_NO_RICHER_FIELDS_HTML = `
<html><body>
  <span id="productTitle">Men's Cotton Shirt</span>
  <span class="a-price-whole">799</span>
</body></html>
`;

Deno.test('enrichCandidate: happy path — fetches, parses, and saves via updateProduct, reporting "enriched"', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 1, store: 'Amazon' } });
  const candidate = { id: 1, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0EXAMPLE' };

  await withMockedFetch(
    () => new Response(AMAZON_PAGE_HTML, { status: 200 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'enriched');
      assertEquals(result.productId, 1);
      assertEquals(result.store, 'Amazon');
      assert(result.message.includes('imageUrls'), result.message);
    },
  );
});

Deno.test('enrichCandidate: reports "unsupported_store" for a store with no registered parser, without ever fetching', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 2, store: 'SomeUnknownStore' } });
  const candidate = { id: 2, store: 'SomeUnknownStore', product_url: 'https://example.com/product/2' };

  let fetchCalled = false;
  await withMockedFetch(
    () => {
      fetchCalled = true;
      return new Response('', { status: 200 });
    },
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'unsupported_store');
    },
  );
  assertEquals(fetchCalled, false, 'must never fetch for an unsupported store');
});

Deno.test('enrichCandidate: reports "scrape_blocked" and never fetches when product_url is not allowlisted for the store', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 3, store: 'Amazon' } });
  const candidate = { id: 3, store: 'Amazon', product_url: 'https://evil.example.com/dp/B0FAKE' };

  let fetchCalled = false;
  await withMockedFetch(
    () => {
      fetchCalled = true;
      return new Response('', { status: 200 });
    },
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'scrape_blocked');
      assert(result.message.toLowerCase().includes('allowlisted'), result.message);
    },
  );
  assertEquals(fetchCalled, false, 'must never fetch a non-allowlisted product_url');
});

Deno.test('enrichCandidate: reports "not_found" for a real 404 response', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 4, store: 'Amazon' } });
  const candidate = { id: 4, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0GONE' };

  await withMockedFetch(
    () => new Response('Not found', { status: 404 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'not_found');
    },
  );
});

Deno.test('enrichCandidate: reports "scrape_blocked" for a non-2xx, non-404 response', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 5, store: 'Amazon' } });
  const candidate = { id: 5, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0BLOCKED' };

  await withMockedFetch(
    () => new Response('blocked', { status: 503 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'scrape_blocked');
      assert(result.message.includes('503'), result.message);
    },
  );
});

// The "response came from an unexpected host after a redirect" branch
// (isExpectedHost's real deny path) isn't independently re-tested here: a
// manually-constructed `Response` in Deno's fetch implementation always
// reports `res.url === ''` (the constructor doesn't accept/honor a `url`
// option — confirmed directly against the Deno runtime this session), and
// isExpectedHost treats an empty url as "no redirect info available, pass"
// by design (see its own doc comment in htmlUtils.ts) — the same limitation
// every one of search-products/scraping/*.test.ts already has, none of
// which attempt to fake this branch either. isExpectedHost's actual
// allow/deny logic is proven directly (with real, non-empty URLs it can
// construct itself) by htmlUtils.test.ts, which this file reuses unmodified
// rather than re-testing.

Deno.test('enrichCandidate: reports "scrape_failed" when the fetch itself throws (network/timeout-level error)', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 7, store: 'Amazon' } });
  const candidate = { id: 7, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0TIMEOUT' };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;
  try {
    const result = await enrichCandidate(client, candidate);
    assertEquals(result.status, 'scrape_failed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('enrichCandidate: reports "scrape_blocked" when the page fetches fine but the parser cannot parse it at all', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 8, store: 'Amazon' } });
  const candidate = { id: 8, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0UNPARSEABLE' };

  await withMockedFetch(
    () => new Response('<html><body>Sorry, something went wrong.</body></html>', { status: 200 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'scrape_blocked');
    },
  );
});

Deno.test('enrichCandidate: reports "scrape_blocked" when the page parses fine but yields no richer fields at all — never claims success', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 9, store: 'Amazon' } });
  const candidate = { id: 9, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0NOTHINGNEW' };

  await withMockedFetch(
    () => new Response(AMAZON_PAGE_NO_RICHER_FIELDS_HTML, { status: 200 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'scrape_blocked');
      assert(result.message.toLowerCase().includes('no description'), result.message);
    },
  );
});

Deno.test('enrichCandidate: reports "scrape_failed" when extraction succeeds but the DB write fails', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 10, store: 'Amazon' }, updateError: true });
  const candidate = { id: 10, store: 'Amazon', product_url: 'https://www.amazon.in/dp/B0DBFAIL' };

  await withMockedFetch(
    () => new Response(AMAZON_PAGE_HTML, { status: 200 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'scrape_failed');
      assert(result.message.toLowerCase().includes('failed to save'), result.message);
    },
  );
});

// Regression coverage for the QA-proven bug: updateProduct() previously had
// no length/count validation of its own, so a genuinely oversized field
// extracted from a live page would have been written to the DB unchecked.
// jsonld.ts (which myntra.ts/ajio.ts/meesho.ts/nykaaFashion.ts all use) is
// the one real parser path with no self-imposed length cap on `description`
// (unlike amazon.ts's own MAX_DESCRIPTION_LENGTH=3000, which is comfortably
// under updateProduct's shared cap and so never exercises this branch) — it
// deliberately defers that to whatever writes the value, per its own header
// comment. This confirms updateProduct() now rejects that oversized value,
// and — same "additive, best-effort" posture as the DB-write-failure test
// above — enrichCandidate maps that rejection to a clean 'scrape_failed'
// result rather than throwing or otherwise producing a hard failure; the
// underlying product row (already in the catalog — this is enrichment, not
// creation) is left exactly as it was.
const MYNTRA_OVERSIZED_DESCRIPTION_HTML = `
<html><head>
<script type="application/ld+json">
${
  JSON.stringify({
    '@type': 'Product',
    name: "Men's Cotton Shirt",
    brand: 'TestBrand',
    offers: { price: '799' },
    image: 'https://example.com/img.jpg',
    description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1),
  })
}
</script>
</head><body></body></html>
`;

Deno.test('enrichCandidate: an oversized extracted `description` (over updateProduct\'s shared cap) is rejected as "scrape_failed", never thrown, never a hard failure', async () => {
  const client = createFakeSupabaseForUpdate({ product: { id: 11, store: 'Myntra' } });
  const candidate = { id: 11, store: 'Myntra', product_url: 'https://www.myntra.com/testbrand/mens-cotton-shirt/12345/buy' };

  await withMockedFetch(
    () => new Response(MYNTRA_OVERSIZED_DESCRIPTION_HTML, { status: 200 }),
    async () => {
      const result = await enrichCandidate(client, candidate);
      assertEquals(result.status, 'scrape_failed');
      assert(result.message.toLowerCase().includes('description'), result.message);
    },
  );
});

// --- runEnrichmentLoop (the elapsed-time defense-in-depth guard) ---
//
// enrichOne/now/sleep are all injected fakes here — no real Supabase client,
// no real globalThis.fetch mocking, and (critically) no real multi-second
// waiting, even though this is exercising a wall-clock-time guard. `now` is
// a scripted fake clock (a queue of millisecond values, one per call) so a
// test can deterministically simulate "110 seconds have somehow already
// elapsed" without an actual 110-second sleep; `sleep` resolves immediately
// so the politeness delay between candidates never actually pauses the test.

function fakeCandidate(id: number): { id: number; store: string; product_url: string } {
  return { id, store: 'Amazon', product_url: `https://www.amazon.in/dp/B0FAKE${id}` };
}

function fakeEnrichedResult(candidate: { id: number; store: string }): EnrichItemResult {
  return { productId: candidate.id, store: candidate.store, status: 'enriched', message: 'ok' };
}

// A scripted fake clock: returns the next value from `values` on each call,
// repeating the final value once the queue is exhausted (so a loop that
// calls `now()` more times than scripted doesn't throw/underflow — it just
// behaves as if time stopped advancing, which never happens to matter in
// these tests since every assertion is about calls made before exhaustion).
function scriptedClock(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

Deno.test('runEnrichmentLoop: processes every candidate sequentially with a delay between each when the budget is ample, never stopping early', async () => {
  const candidates = [fakeCandidate(1), fakeCandidate(2), fakeCandidate(3)];
  const processedIds: number[] = [];
  const sleepCalls: number[] = [];

  const result = await runEnrichmentLoop({
    candidates,
    enrichOne: (c) => {
      processedIds.push(c.id);
      return Promise.resolve(fakeEnrichedResult(c));
    },
    onItem: () => {},
    delayMs: 2000,
    safeBudgetMs: 120_000,
    fetchTimeoutMs: 15_000,
    now: () => 0, // constant clock: elapsed is always 0, budget never in question
    sleep: (ms) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    },
  });

  assertEquals(processedIds, [1, 2, 3], 'expected every candidate to be attempted, in order');
  assertEquals(sleepCalls, [2000, 2000], 'expected a delay before candidates 2 and 3 only, never before the first');
  assertEquals(result, { stoppedEarly: false, processedCount: 3, requestedCount: 3 });
});

Deno.test('runEnrichmentLoop: the elapsed-time guard stops the loop early when continuing risks exceeding the safe budget, returning an honest partial result', async () => {
  const candidates = [fakeCandidate(1), fakeCandidate(2), fakeCandidate(3), fakeCandidate(4)];
  const processedIds: number[] = [];
  const items: EnrichItemResult[] = [];

  // now() is called once for `startedAt` (0ms), then once per candidate
  // after the first to compute elapsed time. Scripting the second call to
  // report 110_000ms simulates "110s have already elapsed" right before
  // candidate 2 would start — with a 120_000ms safeBudgetMs, that leaves
  // only 10_000ms remaining, which is less than delayMs (2000) +
  // fetchTimeoutMs (15_000) = 17_000ms, so the guard must trigger and stop
  // before candidate 2 is ever attempted.
  const now = scriptedClock([0, 110_000]);

  const result = await runEnrichmentLoop({
    candidates,
    enrichOne: (c) => {
      processedIds.push(c.id);
      return Promise.resolve(fakeEnrichedResult(c));
    },
    onItem: (item) => items.push(item),
    delayMs: 2000,
    safeBudgetMs: 120_000,
    fetchTimeoutMs: 15_000,
    now,
    sleep: () => Promise.resolve(),
  });

  assertEquals(processedIds, [1], 'expected only the first candidate to be attempted before the guard stopped the loop');
  assertEquals(items.length, 1, 'the one completed item must still be reported, not discarded');
  assertEquals(result, { stoppedEarly: true, processedCount: 1, requestedCount: 4 });
});

Deno.test('runEnrichmentLoop: never stops before attempting the first candidate, regardless of budget', async () => {
  const candidates = [fakeCandidate(1)];
  let processed = false;

  const result = await runEnrichmentLoop({
    candidates,
    enrichOne: (c) => {
      processed = true;
      return Promise.resolve(fakeEnrichedResult(c));
    },
    onItem: () => {},
    delayMs: 2000,
    safeBudgetMs: 120_000,
    fetchTimeoutMs: 15_000,
    // An already-exhausted budget — if the guard ran before the first
    // candidate, this would stop the loop with zero items processed. It
    // must not: the guard only ever applies *after* the first candidate.
    now: () => 500_000,
    sleep: () => Promise.resolve(),
  });

  assert(processed, 'the first candidate must always be attempted even with an already-exhausted budget');
  assertEquals(result, { stoppedEarly: false, processedCount: 1, requestedCount: 1 });
});
