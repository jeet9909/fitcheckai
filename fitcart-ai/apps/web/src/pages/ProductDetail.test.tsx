import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../data/products';

const navigateMock = vi.fn();
const toggleSaveMock = vi.fn();
const fetchMatchGroupMock = vi.fn();

// Mutated per-test to simulate useParams()'s `:id` route param. Read inside
// a closure (not at vi.mock's own hoisted call time) so ProductDetail's
// same-mounted-component-across-navigations behavior (App.tsx's single
// /product/:id Route) can be simulated with rerender() after mutating this.
let paramsId: string | undefined;
let productsMock: Product[] = [];
let savedProductIdsMock: number[] = [];

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({ id: paramsId }),
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({
    products: productsMock,
    savedProductIds: savedProductIdsMock,
    toggleSave: toggleSaveMock,
  }),
}));

vi.mock('../lib/api', () => ({
  fetchMatchGroup: fetchMatchGroupMock,
}));

const { default: ProductDetail } = await import('./ProductDetail');

function makeProduct(overrides: Partial<Product> & { id: number }): Product {
  return {
    name: `Product ${overrides.id}`,
    brand: 'BrandX',
    store: 'Amazon',
    category: 'Shirts',
    bucket: 'Clothing',
    slot: 'top',
    price: 100,
    mrp: 200,
    color: 'green',
    material: 'Cotton',
    fitScore: 80,
    confidence: 80,
    breakdown: [],
    source: 'live',
    imageUrl: undefined,
    sizeChart: undefined,
    ...overrides,
  };
}

describe('ProductDetail', () => {
  afterEach(() => {
    navigateMock.mockReset();
    toggleSaveMock.mockReset();
    fetchMatchGroupMock.mockReset();
    paramsId = undefined;
    productsMock = [];
    savedProductIdsMock = [];
  });

  describe('stale-fetch cancellation guard', () => {
    it('never applies product A\'s slow-resolving match group to product B\'s page after navigating away', async () => {
      const productA = makeProduct({ id: 1, name: 'Product A' });
      const productB = makeProduct({ id: 2, name: 'Product B' });
      productsMock = [productA, productB];

      let resolveA: (members: Product[]) => void = () => {};
      const pendingA = new Promise<Product[]>((resolve) => {
        resolveA = resolve;
      });

      fetchMatchGroupMock.mockImplementation((productId: number) => {
        if (productId === 1) return pendingA;
        // Product B genuinely has no match group — the common case per
        // fetchMatchGroup's own contract (lib/api.ts).
        return Promise.resolve([]);
      });

      paramsId = '1';
      const { rerender } = render(<ProductDetail />);

      await waitFor(() => expect(fetchMatchGroupMock).toHaveBeenCalledWith(1));
      expect(screen.getByText('Product A')).toBeInTheDocument();

      // Simulate rapid navigation to product B (App.tsx reuses the same
      // mounted <ProductDetail /> across /product/:id changes) — product A's
      // fetchMatchGroup(1) call is still in flight at this point.
      paramsId = '2';
      rerender(<ProductDetail />);

      await waitFor(() => expect(fetchMatchGroupMock).toHaveBeenCalledWith(2));
      expect(screen.getByText('Product B')).toBeInTheDocument();

      // Now let product A's slow fetch resolve, AFTER the user has already
      // navigated to product B. Without the effect's `cancelled` guard, this
      // would incorrectly call setMatchGroupMembers with A's stale data
      // while B is on screen.
      await act(async () => {
        resolveA([makeProduct({ id: 99, store: 'Flipkart', price: 999, productUrl: 'https://flipkart.com/p/99' })]);
        await pendingA;
      });

      // Product A's stale match-group data must never render on B's page.
      expect(screen.queryByText(/Flipkart/)).not.toBeInTheDocument();
      expect(screen.queryByText(/₹999/)).not.toBeInTheDocument();
      // Product B genuinely has no match group, so the section renders nothing.
      expect(screen.queryByText('Also available at')).not.toBeInTheDocument();
      expect(screen.getByText('Product B')).toBeInTheDocument();
    });

    it('applies a fetch that resolves normally (no navigation in between) to the correct product', async () => {
      const product = makeProduct({ id: 5, name: 'Solo Product' });
      productsMock = [product];
      fetchMatchGroupMock.mockResolvedValue([
        makeProduct({ id: 6, store: 'Myntra', price: 555, productUrl: 'https://www.myntra.com/p/6' }),
      ]);

      paramsId = '5';
      render(<ProductDetail />);

      expect(await screen.findByText('Also available at')).toBeInTheDocument();
      expect(screen.getAllByText('Myntra').length).toBeGreaterThan(0);
      expect(screen.getByText(/₹555/)).toBeInTheDocument();
    });
  });

  describe('unknown/invalid :id', () => {
    it('renders the blank fallback (no crash) for an id not present in the loaded catalog', () => {
      productsMock = [makeProduct({ id: 1, name: 'Only Product' })];
      paramsId = '999999';

      expect(() => render(<ProductDetail />)).not.toThrow();
      expect(screen.queryByText('Only Product')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(fetchMatchGroupMock).not.toHaveBeenCalled();
    });

    it('renders the blank fallback (no crash) for a non-numeric id', () => {
      productsMock = [makeProduct({ id: 1, name: 'Only Product' })];
      paramsId = 'not-a-number';

      expect(() => render(<ProductDetail />)).not.toThrow();
      expect(screen.queryByText('Only Product')).not.toBeInTheDocument();
      expect(fetchMatchGroupMock).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('renders nothing in the "Also available at" section for a product with no match group', async () => {
      const product = makeProduct({ id: 10, name: 'No Group Product' });
      productsMock = [product];
      fetchMatchGroupMock.mockResolvedValue([]);

      paramsId = '10';
      render(<ProductDetail />);

      expect(screen.getByText('No Group Product')).toBeInTheDocument();
      await waitFor(() => expect(fetchMatchGroupMock).toHaveBeenCalledWith(10));
      expect(screen.queryByText('Also available at')).not.toBeInTheDocument();
    });

    it('renders AlsoAvailableAt with the returned members for a product with a match group', async () => {
      const product = makeProduct({ id: 11, name: 'Grouped Product' });
      productsMock = [product];
      fetchMatchGroupMock.mockResolvedValue([
        makeProduct({ id: 12, store: 'AJIO', price: 349, productUrl: 'https://www.ajio.com/p/12' }),
      ]);

      paramsId = '11';
      render(<ProductDetail />);

      expect(await screen.findByText('Also available at')).toBeInTheDocument();
      expect(screen.getAllByText('AJIO').length).toBeGreaterThan(0);
      expect(screen.getByText(/₹349/)).toBeInTheDocument();
    });
  });

  describe('honest empty-state fields (pre-existing, regression check)', () => {
    it('hides the brand suffix when brand is "Unknown"', () => {
      productsMock = [makeProduct({ id: 20, name: 'Unbranded Product', brand: 'Unknown', store: 'Amazon' })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '20';

      render(<ProductDetail />);

      expect(screen.getByText('Unbranded Product')).toBeInTheDocument();
      expect(screen.queryByText(/Unknown/)).not.toBeInTheDocument();
    });

    it('shows the honest "not available yet" message instead of a fake confidence card when breakdown is empty', () => {
      productsMock = [makeProduct({ id: 21, name: 'No Fit Data Product', breakdown: [] })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '21';

      render(<ProductDetail />);

      expect(screen.getByText(/personalized fit estimate isn't available for this item yet/i)).toBeInTheDocument();
      expect(screen.queryByText(/^Confidence \d+%$/)).not.toBeInTheDocument();
    });

    it('shows the real confidence card when a breakdown is present', () => {
      productsMock = [makeProduct({
        id: 22,
        name: 'Fit Data Product',
        confidence: 82,
        breakdown: [{ label: 'Shoulders', value: 'True to size', tone: 'good' }],
      })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '22';

      render(<ProductDetail />);

      expect(screen.getByText('How this may fit you')).toBeInTheDocument();
      expect(screen.getByText('Confidence 82%')).toBeInTheDocument();
      expect(screen.getByText('Shoulders')).toBeInTheDocument();
      expect(screen.queryByText(/isn't available for this item yet/i)).not.toBeInTheDocument();
    });
  });
});
