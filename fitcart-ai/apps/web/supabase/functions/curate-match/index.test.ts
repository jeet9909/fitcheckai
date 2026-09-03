// Exercises curate-match's request-validation layer (auth, method, body
// shape) by importing index.ts as a module and invoking the registered
// Deno.serve handler directly — no real HTTP listener, no real DB, no real
// network. Only paths that return before ever calling createMatchGroup are
// covered here (mirrors populate-catalog/index.test.ts exactly); the
// DB-touching behavior of createMatchGroup itself (including the "product
// already in another group" rejection) is covered by matchGroups.test.ts
// against a fake Supabase client.

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

if (!capturedHandler) throw new Error('curate-match/index.ts did not register a Deno.serve handler');
const handler = capturedHandler;

const SECRET_ENV_KEY = 'CURATE_MATCH_SECRET';

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

Deno.test('curate-match: rejects a non-POST method with 405', async () => {
  const res = await handler(new Request('https://example.com/', { method: 'GET' }));
  assertEquals(res.status, 405);
});

Deno.test('curate-match: rejects a request with no x-curate-match-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({}));
    assertEquals(res.status, 401);
    const data = await res.json();
    // Never leaks any detail about the expected secret.
    assertEquals(typeof data.error, 'string');
  });
});

Deno.test('curate-match: rejects a request with a wrong x-curate-match-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({}, { 'x-curate-match-secret': 'wrong-secret' }));
    assertEquals(res.status, 401);
  });
});

Deno.test('curate-match: rejects every request as unauthorized when the server-side secret env var is unset', async () => {
  await withSecret(undefined, async () => {
    const res = await handler(post({}, { 'x-curate-match-secret': '' }));
    assertEquals(res.status, 401);
  });
});

Deno.test('curate-match: a correct secret with malformed JSON body is a 400, not a 401/500', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-curate-match-secret': 'correct-secret' },
        body: 'not json',
      }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-match: rejects a non-array `productIds` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productIds: 'not-an-array', label: 'Some Item', createdBy: 'curator@fitcartai.com' }, { 'x-curate-match-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('productIds'));
  });
});

Deno.test('curate-match: rejects `productIds` containing a non-integer/negative/zero value as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badIds of [[1, 2.5], [1, -2], [0, 1], [1, 'two']]) {
      const res = await handler(
        post({ productIds: badIds, label: 'Some Item', createdBy: 'curator@fitcartai.com' }, { 'x-curate-match-secret': 'correct-secret' }),
      );
      assertEquals(res.status, 400, `expected 400 for productIds: ${JSON.stringify(badIds)}`);
    }
  });
});

Deno.test('curate-match: rejects a productId above Number.MAX_SAFE_INTEGER as 400 (float-precision id-collision guard)', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post(
        { productIds: [1, Number.MAX_SAFE_INTEGER + 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' },
        { 'x-curate-match-secret': 'correct-secret' },
      ),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('productIds'));
  });
});

Deno.test('curate-match: rejects duplicate ids within `productIds` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productIds: [1, 2, 2], label: 'Some Item', createdBy: 'curator@fitcartai.com' }, { 'x-curate-match-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.toLowerCase().includes('duplicate'));
  });
});

Deno.test('curate-match: rejects fewer than 2 productIds as 400 ("a match group of one product is meaningless")', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productIds: [1], label: 'Some Item', createdBy: 'curator@fitcartai.com' }, { 'x-curate-match-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-match: rejects more than 10 productIds as 400', async () => {
  await withSecret('correct-secret', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1);
    const res = await handler(
      post({ productIds: ids, label: 'Some Item', createdBy: 'curator@fitcartai.com' }, { 'x-curate-match-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-match: rejects a missing/empty `label` as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badLabel of [undefined, '', '   ', 42]) {
      const body: Record<string, unknown> = { productIds: [1, 2], createdBy: 'curator@fitcartai.com' };
      if (badLabel !== undefined) body.label = badLabel;
      const res = await handler(post(body, { 'x-curate-match-secret': 'correct-secret' }));
      assertEquals(res.status, 400, `expected 400 for label: ${JSON.stringify(badLabel)}`);
    }
  });
});

Deno.test('curate-match: rejects a `label` over MAX_LABEL_LENGTH as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productIds: [1, 2], label: 'x'.repeat(201), createdBy: 'curator@fitcartai.com' }, { 'x-curate-match-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-match: rejects a missing/empty `createdBy` as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badCreatedBy of [undefined, '', '   ', 42]) {
      const body: Record<string, unknown> = { productIds: [1, 2], label: 'Some Item' };
      if (badCreatedBy !== undefined) body.createdBy = badCreatedBy;
      const res = await handler(post(body, { 'x-curate-match-secret': 'correct-secret' }));
      assertEquals(res.status, 400, `expected 400 for createdBy: ${JSON.stringify(badCreatedBy)}`);
    }
  });
});

Deno.test('curate-match: rejects a `createdBy` over MAX_CREATED_BY_LENGTH as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productIds: [1, 2], label: 'Some Item', createdBy: 'x'.repeat(201) }, { 'x-curate-match-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
  });
});
