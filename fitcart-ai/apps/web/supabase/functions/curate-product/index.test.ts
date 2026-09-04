// Exercises curate-product's request-validation layer (auth, method, body
// shape) by importing index.ts as a module and invoking the registered
// Deno.serve handler directly — no real HTTP listener, no real DB, no real
// network. Only paths that return before ever calling updateProduct are
// covered here (mirrors curate-match/index.test.ts exactly); the
// DB-touching behavior of updateProduct itself (including the per-store
// image-URL allowlist check) is covered by updateProduct.test.ts against a
// fake Supabase client.

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

if (!capturedHandler) throw new Error('curate-product/index.ts did not register a Deno.serve handler');
const handler = capturedHandler;

const SECRET_ENV_KEY = 'CURATE_PRODUCT_SECRET';

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

Deno.test('curate-product: rejects a non-POST method with 405', async () => {
  const res = await handler(new Request('https://example.com/', { method: 'GET' }));
  assertEquals(res.status, 405);
});

Deno.test('curate-product: rejects a request with no x-curate-product-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({}));
    assertEquals(res.status, 401);
    const data = await res.json();
    // Never leaks any detail about the expected secret.
    assertEquals(typeof data.error, 'string');
  });
});

Deno.test('curate-product: rejects a request with a wrong x-curate-product-secret header as 401', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({}, { 'x-curate-product-secret': 'wrong-secret' }));
    assertEquals(res.status, 401);
  });
});

Deno.test('curate-product: rejects every request as unauthorized when the server-side secret env var is unset', async () => {
  await withSecret(undefined, async () => {
    const res = await handler(post({}, { 'x-curate-product-secret': '' }));
    assertEquals(res.status, 401);
  });
});

Deno.test('curate-product: a correct secret with malformed JSON body is a 400, not a 401/500', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      new Request('https://example.com/', {
        method: 'POST',
        headers: { 'x-curate-product-secret': 'correct-secret' },
        body: 'not json',
      }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-product: rejects a missing/non-integer/non-positive `productId` as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badId of [undefined, 'not-a-number', 1.5, -1, 0, Number.MAX_SAFE_INTEGER + 2]) {
      const body: Record<string, unknown> = { description: 'A nice shirt.' };
      if (badId !== undefined) body.productId = badId;
      const res = await handler(post(body, { 'x-curate-product-secret': 'correct-secret' }));
      assertEquals(res.status, 400, `expected 400 for productId: ${JSON.stringify(badId)}`);
      const data = await res.json();
      assert(typeof data.error === 'string' && data.error.includes('productId'));
    }
  });
});

Deno.test('curate-product: rejects a request with `productId` but no optional fields as 400 ("nothing to update")', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ productId: 1 }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.toLowerCase().includes('nothing to update'));
  });
});

Deno.test('curate-product: rejects a non-string `description` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ productId: 1, description: 42 }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('description'));
  });
});

Deno.test('curate-product: rejects a `description` over the max length as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productId: 1, description: 'x'.repeat(5001) }, { 'x-curate-product-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-product: rejects a non-string `material` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ productId: 1, material: 42 }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('material'));
  });
});

Deno.test('curate-product: rejects a `material` over the max length as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ productId: 1, material: 'x'.repeat(201) }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
  });
});

// `color` is deliberately NOT a curator-writable field here (see index.ts's
// header comment for why: a curator-set value would be silently reverted by
// the next scrape-driven upsert in search-products/persistCatalog.ts).
// Regression guard against that being reintroduced by accident: a request
// whose *only* field besides `productId` is `color` must be treated
// identically to a request with no optional fields at all — i.e. rejected as
// "nothing to update", never accepted as a valid partial update.
Deno.test('curate-product: treats a `color`-only body (besides productId) as "nothing to update", never as a valid field', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ productId: 1, color: 'Navy' }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.toLowerCase().includes('nothing to update'));
  });
});

Deno.test('curate-product: rejects a non-object `sizeChart` (array, string, number, null) as 400', async () => {
  await withSecret('correct-secret', async () => {
    for (const badSizeChart of [[1, 2], 'chart', 42, null]) {
      const res = await handler(
        post({ productId: 1, sizeChart: badSizeChart }, { 'x-curate-product-secret': 'correct-secret' }),
      );
      assertEquals(res.status, 400, `expected 400 for sizeChart: ${JSON.stringify(badSizeChart)}`);
      const data = await res.json();
      assert(typeof data.error === 'string' && data.error.includes('sizeChart'));
    }
  });
});

Deno.test('curate-product: rejects an oversized `sizeChart` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const hugeSizeChart = { chest: 'x'.repeat(5000) };
    const res = await handler(post({ productId: 1, sizeChart: hugeSizeChart }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('sizeChart'));
  });
});

Deno.test('curate-product: rejects a non-array `imageUrls` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(post({ productId: 1, imageUrls: 'not-an-array' }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(typeof data.error === 'string' && data.error.includes('imageUrls'));
  });
});

Deno.test('curate-product: rejects more than 10 `imageUrls` as 400', async () => {
  await withSecret('correct-secret', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://images.amazon.in/img${i}.jpg`);
    const res = await handler(post({ productId: 1, imageUrls: urls }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-product: rejects `imageUrls` containing a non-string entry as 400', async () => {
  await withSecret('correct-secret', async () => {
    const res = await handler(
      post({ productId: 1, imageUrls: ['https://images.amazon.in/img.jpg', 42] }, { 'x-curate-product-secret': 'correct-secret' }),
    );
    assertEquals(res.status, 400);
  });
});

Deno.test('curate-product: rejects an `imageUrls` entry over the max URL length as 400', async () => {
  await withSecret('correct-secret', async () => {
    const tooLongUrl = 'https://images.amazon.in/' + 'x'.repeat(2001) + '.jpg';
    const res = await handler(post({ productId: 1, imageUrls: [tooLongUrl] }, { 'x-curate-product-secret': 'correct-secret' }));
    assertEquals(res.status, 400);
  });
});
