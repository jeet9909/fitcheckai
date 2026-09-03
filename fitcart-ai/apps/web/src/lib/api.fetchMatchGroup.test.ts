import { afterEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: fromMock },
}));

// Imported after the mock so `api.ts` picks up the mocked `./supabase` module.
const { fetchMatchGroup } = await import('./api');

// Builds a chainable query-builder mock matching the subset of the
// supabase-js interface fetchMatchGroup actually calls: chain methods
// (select/eq/neq/limit/in) return the same object, `maybeSingle()` resolves
// directly, and the object itself is thenable (awaiting the chain without
// calling `.maybeSingle()` — as the 2nd and 3rd queries do — resolves the
// same way a real supabase-js PostgrestBuilder does).
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    in: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

describe('fetchMatchGroup', () => {
  afterEach(() => {
    fromMock.mockReset();
  });

  it('returns an empty array (fast, no error) when the product is not in any match group', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'product_match_members') return makeChain({ data: null, error: null });
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await fetchMatchGroup(1);

    expect(result).toEqual([]);
  });

  it('returns an empty array when the membership lookup errors, without throwing', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'product_match_members') return makeChain({ data: null, error: { message: 'boom' } });
      throw new Error(`unexpected table: ${table}`);
    });

    await expect(fetchMatchGroup(1)).resolves.toEqual([]);
  });

  it('returns an empty array when the product is the only member of its group', async () => {
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'product_match_members') {
        call += 1;
        if (call === 1) return makeChain({ data: { match_group_id: 9 }, error: null });
        return makeChain({ data: [], error: null });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await fetchMatchGroup(1);

    expect(result).toEqual([]);
  });

  it('resolves the other members of the group into full Product rows', async () => {
    let membersCall = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'product_match_members') {
        membersCall += 1;
        if (membersCall === 1) return makeChain({ data: { match_group_id: 9 }, error: null });
        return makeChain({ data: [{ product_id: 2 }, { product_id: 3 }], error: null });
      }
      if (table === 'products') {
        return makeChain({
          data: [
            { id: 2, name: 'Same Shirt on Flipkart', brand: 'BrandX', store: 'Flipkart', category: 'Shirts', bucket: 'Clothing', slot: 'top', price: 799, mrp: 999, color: 'blue', material: 'Cotton', fit_score: 80, confidence: 80, breakdown: [], source: 'live', product_url: 'https://www.flipkart.com/p/2', image_url: null, size_chart: null },
            { id: 3, name: 'Same Shirt on Myntra', brand: 'BrandX', store: 'Myntra', category: 'Shirts', bucket: 'Clothing', slot: 'top', price: 849, mrp: 999, color: 'blue', material: 'Cotton', fit_score: 80, confidence: 80, breakdown: [], source: 'live', product_url: 'https://www.myntra.com/p/3', image_url: null, size_chart: null },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await fetchMatchGroup(1);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual([2, 3]);
    expect(result[0]).toMatchObject({ id: 2, store: 'Flipkart', price: 799, productUrl: 'https://www.flipkart.com/p/2' });
    expect(result[1]).toMatchObject({ id: 3, store: 'Myntra', price: 849, productUrl: 'https://www.myntra.com/p/3' });
    expect(fromMock).toHaveBeenCalledWith('product_match_members');
    expect(fromMock).toHaveBeenCalledWith('products');
  });

  it('returns an empty array when the final products query errors', async () => {
    let membersCall = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'product_match_members') {
        membersCall += 1;
        if (membersCall === 1) return makeChain({ data: { match_group_id: 9 }, error: null });
        return makeChain({ data: [{ product_id: 2 }], error: null });
      }
      if (table === 'products') return makeChain({ data: null, error: { message: 'boom' } });
      throw new Error(`unexpected table: ${table}`);
    });

    await expect(fetchMatchGroup(1)).resolves.toEqual([]);
  });

  it('returns an empty array without querying supabase when Supabase is not configured', async () => {
    vi.resetModules();
    vi.doMock('./supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
    const { fetchMatchGroup: fetchMatchGroup2 } = await import('./api');

    const result = await fetchMatchGroup2(1);

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();

    vi.doUnmock('./supabase');
  });
});
