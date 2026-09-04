// Exercises enrich-catalog's request-validation layer (auth, method, body
// shape) by importing index.ts as a module and invoking the registered
// Deno.serve handler directly — no real HTTP listener, no real DB, no real
// network. Only paths that return before ever calling selectCandidates are
// covered here (mirrors populate-catalog/index.test.ts and curate-match/
// index.test.ts exactly); the DB/network-touching behavior of
// selectCandidates/enrichCandidate themselves is covered by
// candidates.test.ts against a fake Supabase client + mocked
// globalThis.fetch.

import { assert, assertEquals } from '../search-products/_testUtils.ts';

// Deno.serve registers a handler immediately at import time; capturing it
// via a stub lets these tests call the exact same handler `deno deploy`
// would, without starting a real listener.
// deno-lint-ignore no-explicit-any
let capturedHandler: ((req: Request) => Response | Promise<Response>) | undefined;
const originalServe = Deno.serve;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = ((handler: any) => {
  capturedHandler = handler;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() } as unknown as ReturnType<typeof Deno.serve>;
}) as typeof Deno.serve;

// index.ts constructs its Supabase client at module scope; a genuinely
// empty/missing SUPABASE_URL makes `createClient` throw immediately at
// import time ("supabaseUrl is required"). Only these two vars are set here
// (harmless placeholder values — no real client method is ever invoked in
// this file's tests, which only exercise the validation paths that return
// before any DB call).
const hadUrl = Deno.env.get('SUPABASE_URL');
const hadKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!hadUrl) Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
if (!hadKey) Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-placeholder-key');

await import('./index.ts');
Deno.serve = originalServe;

if (!capturedHandler) throw new Error('enrich-catalog/index.ts did not register a Deno.serve handler');
const handler = capturedHandler;

const SECRET_ENV_KEY = 'ENRICH_CATALOG_SECRET';

function withSecret(value: string | undefined, fn: () => Promise<void>): Promise<void> {
  const original = Deno.env.get(SECRET_ENV_KEY);
  if (value === undefined) Deno.env.delete(SECRET_ENV_KEY);
  else Deno.env.set(SECRET_ENV_KEY, value);
  return fn().finally(() => {
    if (original === undefined) Deno.env.delete(SECRET_ENV_KEY);
    else Deno.env.set(SECRET_ENV_KEY, original);
  });
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

Deno.test('enrich-catalog: rejects a non-POST method with 405', async () => {
  const res = await handler(new Request('https://example.com/', { method: 'GET' }));
  assertEquals(res.status, 405);
});

Deno.test('enrich-catalog: rejects a request with no x-enrich-catalog-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({}));
    assertEquals(res.status, 401);
    const data = await res.json();
    // Never leaks any detail about the expected secret.
    assertEquals(typeof data.error, 'string');
  });
});

Deno.test('enrich-catalog: rejects a request with a wrong x-enrich-catalog-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({}, { 'x-enrich-catalog-secret': 'wrong-secret' }));
    assertEquals(res.status, 401);
  });
});

Deno.test('enrich-catalog: rejects every request as unauthorized when the server-side secret env var is unset', async () => {
  await withSecret(undefined, async () => {
    const res = await handler(post({}, { 'x-enrich-catalog-secret': '' }));
    assertEquals(res.status, 401);
  });
});

Deno.test('enrich-catalog: a correct secret with malformed JSON body is a 400, not a 401/500', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-enrich-catalog-secret': 'correct-secret' },
        body: 'not json',
      }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('enrich-catalog: rejects a non-array/empty `stores` as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badStores of ['Amazon', [], 42]) {
      const res = await handler(post({ stores: badStores }, { 'x-enrich-catalog-secret': 'correct-secret' }));
      assertEquals(res.status, 400, `expected 400 for stores: ${JSON.stringify(badStores)}`);
    }
  });
});

Deno.test('enrich-catalog: rejects an unknown store name as 400, naming it', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ stores: ['NotARealStore'] }, { 'x-enrich-catalog-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('NotARealStore'));
  });
});

Deno.test('enrich-catalog: accepts every one of the six real store names in `stores` (validation-only — never reaches a real DB/network call in this test)', async () => {
  await withSecret('correct-secret', async () => {
    // `limit: 0` is invalid, so this reaches the limit-validation 400 before
    // ever calling selectCandidates — proves `stores` itself passed
    // validation for all six without needing to mock the DB/network.
    for (const store of ['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'AJIO', 'Nykaa Fashion']) {
      const res = await handler(
        post({ stores: [store], limit: 0 }, { 'x-enrich-catalog-secret': 'correct-secret' }),
      );
      assertEquals(res.status, 400, `store ${store} should still reach the limit check, not fail on \`stores\` itself`);
      const data = await res.json();
      assert(typeof data.error === 'string' && data.error.includes('limit'), `expected a \`limit\` error for store ${store}, got: ${data.error}`);
    }
  });
});

Deno.test('enrich-catalog: rejects a non-integer/non-positive `limit` as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badLimit of [0, -1, 1.5, 'ten']) {
      const res = await handler(post({ limit: badLimit }, { 'x-enrich-catalog-secret': 'correct-secret' }));
      assertEquals(res.status, 400, `expected 400 for limit: ${JSON.stringify(badLimit)}`);
    }
  });
});

Deno.test('enrich-catalog: rejects a `limit` above MAX_PRODUCTS_PER_INVOCATION (6) as a hard 400, never silently truncated', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ limit: 7 }, { 'x-enrich-catalog-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('6'));
  });
});

Deno.test('enrich-catalog: accepts a `limit` exactly at MAX_PRODUCTS_PER_INVOCATION (6) — validation-only, never reaches a real DB/network call in this test', async () => {
  await withSecret('correct-secret', async () => {
    // `force` is validated *after* `limit`, so a 400 naming `force` (not a
    // `limit` error) proves `limit: 6` itself passed without needing to
    // mock the DB/network.
    const res = await handler(
      post({ limit: 6, force: 'yes' }, { 'x-enrich-catalog-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('force'), data.error);
  });
});

Deno.test('enrich-catalog: rejects a non-boolean `force` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ force: 'yes' }, { 'x-enrich-catalog-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('force'));
  });
});
