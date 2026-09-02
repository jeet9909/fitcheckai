import { afterEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: invokeMock } },
}));

// Imported after the mock so `api.ts` picks up the mocked `./supabase` module.
const { searchMarketplaces } = await import('./api');

describe('searchMarketplaces', () => {
  afterEach(() => {
    invokeMock.mockReset();
  });

  it('parses a full success response into MarketplaceSearchResult', async () => {
    const body = {
      query: "men's shirt",
      mock: false,
      results: [
        { name: 'Shirt A', brand: 'BrandA', price: 999, mrp: 1499, color: 'blue', imageUrl: null, productUrl: 'https://www.amazon.in/dp/1', store: 'Amazon', source: 'live' },
      ],
      providers: {
        amazon: { status: 'success', count: 1, upserted: 1 },
        flipkart: { status: 'not_configured', count: 0, upserted: 0, message: "Flipkart search isn't connected yet." },
      },
    };
    invokeMock.mockResolvedValue({ data: body, error: null });

    const result = await searchMarketplaces("men's shirt", 'all');

    expect(invokeMock).toHaveBeenCalledWith('search-products', { body: { query: "men's shirt", marketplace: 'all' } });
    expect(result).toEqual(body);
  });

  it('surfaces an error status per provider when the function call errors', async () => {
    // The Edge Function's error body shape is `{ error: string }` (see
    // supabase/functions/search-products/index.ts's `json({ error: ... })`
    // calls), not `{ message: string }`. Mocking `{ message: ... }` here
    // would match the old buggy read of `body?.message` and mask a
    // regression — see the "Query too long" test below for the exact
    // real-world shape.
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: 'boom',
        context: { status: 500, json: async () => ({ error: 'Internal error' }) },
      },
    });

    const result = await searchMarketplaces('shoes', 'all');

    expect(result.results).toEqual([]);
    expect(result.providers.amazon?.status).toBe('error');
    expect(result.providers.flipkart?.status).toBe('error');
    expect(result.providers.amazon?.message).toBe('Internal error');
  });

  it('Bug 1 regression: surfaces the backend\'s specific `error` field (e.g. "Query too long") instead of the generic SDK message', async () => {
    // Reproduces supabase/functions/search-products/index.ts's
    // `json({ error: 'Query too long — max 200 characters.' }, 400)`
    // response for an over-length query. Before the fix, api.ts read
    // `body?.message` (which is never set on this response), so the SDK's
    // generic "Edge Function returned a non-2xx status code" always won
    // instead of this specific, actionable reason.
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { status: 400, json: async () => ({ error: 'Query too long — max 200 characters.' }) },
      },
    });

    const result = await searchMarketplaces('a'.repeat(201), 'all');

    expect(result.providers.amazon?.message).toBe('Query too long — max 200 characters.');
    expect(result.providers.flipkart?.message).toBe('Query too long — max 200 characters.');
  });

  it('falls back to the SDK error message when the error response body has neither an `error` nor parses as JSON', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: 'network error',
        context: { status: 500, json: async () => { throw new Error('not json'); } },
      },
    });

    const result = await searchMarketplaces('shoes', 'all');

    expect(result.providers.amazon?.message).toBe('network error');
  });

  it('reports not_configured for both providers when Supabase is unavailable', async () => {
    vi.resetModules();
    vi.doMock('./supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
    const { searchMarketplaces: search2 } = await import('./api');

    const result = await search2('shoes', 'all');

    expect(result.providers.amazon?.status).toBe('not_configured');
    expect(result.providers.flipkart?.status).toBe('not_configured');
    expect(invokeMock).not.toHaveBeenCalled();

    vi.doUnmock('./supabase');
  });
});
