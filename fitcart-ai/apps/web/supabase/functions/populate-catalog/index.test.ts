// Exercises populate-catalog's request-validation layer (auth, method,
// body shape, pair-count cap) by importing index.ts as a module and
// invoking the registered Deno.serve handler directly — no real HTTP
// listener, no real DB, no real network. Only the paths that return before
// ever calling runProvider/upsertAndReport are covered here; the actual
// per-pair fetch/scrape/upsert behavior is already covered by search-
// products' own orchestrator/cacheFirstSearch/scraper test suites, which
// this function reuses unmodified.

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

if (!capturedHandler) throw new Error('populate-catalog/index.ts did not register a Deno.serve handler');
const handler = capturedHandler;

const SECRET_ENV_KEY = 'POPULATE_CATALOG_SECRET';

function withSecret(value: string | undefined, fn: () => Promise<void>): Promise<void> {
  const original = Deno.env.get(SECRET_ENV_KEY);
  if (value === undefined) Deno.env.delete(SECRET_ENV_KEY);
  else Deno.env.set(SECRET_ENV_KEY, value);
  return fn().finally(() => {
    if (original === undefined) Deno.env.delete(SECRET_ENV_KEY);
    else Deno.env.set(SECRET_ENV_KEY, original);
  });
}

Deno.test('populate-catalog: rejects a non-POST method with 405', async () => {
  const res = await handler(new Request('https://example.com/', { method: 'GET' }));
  assertEquals(res.status, 405);
});

Deno.test('populate-catalog: rejects a request with no x-populate-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(new Request('https://example.com/', { method: 'POST', body: '{}' }));
    assertEquals(res.status, 401);
    const data = await res.json();
    // Never leaks any detail about the expected secret.
    assertEquals(typeof data.error, 'string');
  });
});

Deno.test('populate-catalog: rejects a request with a wrong x-populate-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'wrong-secret' },
        body: '{}',
      }),
    );
    assertEquals(res.status, 401);
  });
});

Deno.test('populate-catalog: rejects every request as unauthorized when the server-side secret env var is unset', async () => {
  await withSecret(undefined, async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': '' },
        body: '{}',
      }),
    );
    assertEquals(res.status, 401);
  });
});

Deno.test('populate-catalog: a correct secret with malformed JSON body is a 400, not a 401/500', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'correct-secret' },
        body: 'not json',
      }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('populate-catalog: rejects a `terms`/`stores` combination exceeding MAX_PAIRS_PER_INVOCATION as 400', async () => {
  await withSecret('correct-secret', async () => {
    const manyTerms = Array.from({ length: 20 }, (_, i) => `term-${i}`);
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'correct-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ terms: manyTerms, stores: ['amazon', 'flipkart'] }),
      }),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assertEquals(typeof data.error, 'string');
  });
});

Deno.test('populate-catalog: rejects an unknown store name as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'correct-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ terms: ['shirt'], stores: ['not-a-real-store'] }),
      }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('populate-catalog: rejects an empty `terms` array as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'correct-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ terms: [] }),
      }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('populate-catalog: rejects an unrecognized `amazonNodes` id as 400, never scrapes it speculatively', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'correct-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ terms: ['shirt'], stores: ['amazon'], amazonNodes: ['9999999999'] }),
      }),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('9999999999'));
  });
});

Deno.test('populate-catalog: `amazonNodes` count is summed into the MAX_PAIRS_PER_INVOCATION cap, not ignored', async () => {
  await withSecret('correct-secret', async () => {
    // 4 terms x 6 stores = 24 — exactly at the cap on its own (not over).
    // Adding one verified node must tip it to 25/400 — proves the node
    // count is actually summed into pairCount, not tracked separately or
    // ignored. (Deliberately not a "stays under, expect 200" case — that
    // would fall through into real runProvider/scrape/DB calls, which this
    // file's header comment says these validation-path tests must never
    // reach.)
    const terms = ['shirts', 'jeans', 'shoes', 'jackets'];
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-populate-secret': 'correct-secret', 'content-type': 'application/json' },
        body: JSON.stringify({
          terms,
          stores: ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'nykaaFashion'],
          amazonNodes: ['1968024031'],
        }),
      }),
    );
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('25'));
  });
});
