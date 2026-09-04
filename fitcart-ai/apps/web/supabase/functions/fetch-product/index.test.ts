// Exercises fetch-product's request-validation layer (the two paths that
// return before any real network fetch or DB call: missing `url`, and a
// `url` whose host doesn't match any known store) by importing index.ts as
// a module and invoking the registered Deno.serve handler directly — same
// "handler-capture, no real HTTP listener/DB/network" convention as
// populate-catalog/index.test.ts and curate-match/index.test.ts. The actual
// fetch-a-real-page / parse / upsert / enrichment-write behavior is not
// exercised here (it would require a real network call and a real DB), the
// same boundary those other two files' test suites already draw — instead,
// the new enrichment-payload logic this session added
// (`buildEnrichmentInput`) is a pure function with no I/O, tested directly
// below without any mocking at all.

import { assert, assertEquals } from '../search-products/_testUtils.ts';
import type { ParsedProduct } from './parsers/types.ts';
import { buildEnrichmentInput } from './enrichmentInput.ts';

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

if (!capturedHandler) throw new Error('fetch-product/index.ts did not register a Deno.serve handler');
const handler = capturedHandler;

function post(body: unknown): Request {
  return new Request('https://example.com/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

Deno.test('fetch-product: rejects a request with no `url` as 400, without attempting any fetch', async () => {
  const res = await handler(post({}));
  assertEquals(res.status, 400);
  const data = await res.json();
  assert(typeof data.error === 'string' && data.error.toLowerCase().includes('url'));
});

Deno.test('fetch-product: rejects a non-string `url` as 400', async () => {
  const res = await handler(post({ url: 12345 }));
  assertEquals(res.status, 400);
});

Deno.test('fetch-product: rejects a url whose host matches no known store as 422, without attempting any fetch', async () => {
  const res = await handler(post({ url: 'https://www.some-unsupported-store.example/product/123' }));
  assertEquals(res.status, 422);
  const data = await res.json();
  assert(typeof data.error === 'string' && data.error.toLowerCase().includes('unsupported'));
});

Deno.test('fetch-product: rejects a url whose host does not actually belong to the store its regex substring-matched (SSRF-shaped bypass), without attempting any fetch', async () => {
  // findParserEntryForUrl's regexes (e.g. /amazon.in/i) match anywhere in the
  // URL string, not just the hostname -- this URL "matches" Amazon by that
  // substring rule alone, but its real host is attacker.example. Before the
  // isAllowedMarketplaceUrl re-check this test guards, this would have gone
  // straight into a real outbound fetch() against attacker.example.
  const res = await handler(post({ url: 'https://attacker.example/redirect?to=amazon.in' }));
  assertEquals(res.status, 422);
  const data = await res.json();
  assert(typeof data.error === 'string' && data.error.toLowerCase().includes('domain'));
});

Deno.test('fetch-product: a malformed JSON body is handled by the top-level catch as a 500, never crashes the handler', async () => {
  const res = await handler(
    new Request('https://example.com/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json' }),
  );
  assertEquals(res.status, 500);
});

// --- buildEnrichmentInput: pure mapping, no I/O, no mocking needed ---

function baseParsed(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    name: 'Test Product',
    brand: 'Unknown',
    price: 100,
    mrp: 100,
    color: '',
    imageUrl: null,
    sizeChart: null,
    description: null,
    material: null,
    imageUrls: [],
    ...overrides,
  };
}

Deno.test('buildEnrichmentInput: returns null when the parser found none of the richer fields (the common case for 5 of 6 stores)', () => {
  const result = buildEnrichmentInput(baseParsed());
  assertEquals(result, null);
});

Deno.test('buildEnrichmentInput: includes only `description` when that is the only richer field present', () => {
  const result = buildEnrichmentInput(baseParsed({ description: 'A soft cotton shirt.' }));
  assertEquals(result, { description: 'A soft cotton shirt.' });
});

Deno.test('buildEnrichmentInput: includes only `material` when that is the only richer field present', () => {
  const result = buildEnrichmentInput(baseParsed({ material: 'Cotton Blend' }));
  assertEquals(result, { material: 'Cotton Blend' });
});

Deno.test('buildEnrichmentInput: includes `sizeChart` only when it is a non-null object', () => {
  const sizeChart = { S: { 'IN Size': '36' } };
  const result = buildEnrichmentInput(baseParsed({ sizeChart }));
  assertEquals(result, { sizeChart });
});

Deno.test('buildEnrichmentInput: includes `imageUrls` only when the array is non-empty', () => {
  const imageUrls = ['https://m.media-amazon.com/images/I/one.jpg'];
  const result = buildEnrichmentInput(baseParsed({ imageUrls }));
  assertEquals(result, { imageUrls });
});

Deno.test('buildEnrichmentInput: an empty `imageUrls` array is never included (matches curate-product\'s own "empty array, not sent" convention)', () => {
  const result = buildEnrichmentInput(baseParsed({ imageUrls: [] }));
  assertEquals(result, null);
});

Deno.test('buildEnrichmentInput: combines every present richer field into a single payload', () => {
  const sizeChart = { S: { 'IN Size': '36' } };
  const imageUrls = ['https://m.media-amazon.com/images/I/one.jpg'];
  const result = buildEnrichmentInput(
    baseParsed({ description: 'A soft cotton shirt.', material: 'Cotton', sizeChart, imageUrls }),
  );
  assertEquals(result, { description: 'A soft cotton shirt.', material: 'Cotton', sizeChart, imageUrls });
});
