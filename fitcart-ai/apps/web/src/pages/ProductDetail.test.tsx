import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    description: '',
    fitScore: 80,
    confidence: 80,
    breakdown: [],
    source: 'live',
    imageUrl: undefined,
    imageUrls: [],
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

  describe('curated data (description / gallery / size chart)', () => {
    it('renders exactly as before — no gallery strip, no description section, no size-chart block — for a product with no curated data (the common case)', () => {
      productsMock = [makeProduct({ id: 30, name: 'Plain Product', description: '', imageUrls: [], sizeChart: undefined })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '30';

      const { container } = render(<ProductDetail />);

      expect(screen.getByText('Plain Product')).toBeInTheDocument();
      // No thumbnail strip.
      expect(screen.queryByRole('button', { name: /Show image/i })).not.toBeInTheDocument();
      // Exactly one <img> on the page — the single main product image.
      expect(container.querySelectorAll('img')).toHaveLength(1);
      // No description section.
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
      // No size-chart section.
      expect(screen.queryByText('Size chart')).not.toBeInTheDocument();
    });

    it('renders a clickable thumbnail strip that changes the main image on click when imageUrls is populated', () => {
      productsMock = [makeProduct({
        id: 31,
        name: 'Gallery Product',
        imageUrl: 'https://cdn.example.com/main.jpg',
        imageUrls: ['https://cdn.example.com/alt1.jpg', 'https://cdn.example.com/alt2.jpg'],
      })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '31';

      const { container } = render(<ProductDetail />);

      // Main image + imageUrl-as-first-thumbnail + 2 gallery thumbnails = 4 <img>s.
      expect(container.querySelectorAll('img')).toHaveLength(4);
      const mainImage = container.querySelector('img') as HTMLImageElement;
      expect(mainImage.src).toBe('https://cdn.example.com/main.jpg');

      const secondThumb = screen.getByRole('button', { name: 'Show image 2 of 3' });
      fireEvent.click(secondThumb);

      expect((container.querySelector('img') as HTMLImageElement).src).toBe('https://cdn.example.com/alt1.jpg');
    });

    it('degrades a single broken thumbnail to a placeholder without affecting the other thumbnails', () => {
      productsMock = [makeProduct({
        id: 38,
        name: 'Partially Broken Gallery Product',
        imageUrl: 'https://cdn.example.com/main.jpg',
        imageUrls: ['https://cdn.example.com/good.jpg', 'https://cdn.example.com/broken.jpg'],
      })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '38';

      const { container } = render(<ProductDetail />);

      const brokenThumbButton = screen.getByRole('button', { name: 'Show image 3 of 3' });
      const brokenThumbImg = brokenThumbButton.querySelector('img') as HTMLImageElement;
      expect(brokenThumbImg).not.toBeNull();

      fireEvent.error(brokenThumbImg);

      // The broken thumbnail degrades to a placeholder tile instead of being
      // left as the browser's native broken-image icon — its <img> is gone.
      expect(brokenThumbButton.querySelector('img')).toBeNull();
      expect(brokenThumbButton.querySelector('.placeholder-swatch')).not.toBeNull();

      // The other thumbnails are unaffected — still rendered as real <img>s
      // and still clickable to change the main image.
      const goodThumbButton = screen.getByRole('button', { name: 'Show image 2 of 3' });
      expect(goodThumbButton.querySelector('img')).not.toBeNull();

      fireEvent.click(goodThumbButton);

      expect((container.querySelector('img') as HTMLImageElement).src).toBe('https://cdn.example.com/good.jpg');
    });

    it('renders the description when present', () => {
      productsMock = [makeProduct({ id: 32, name: 'Described Product', description: 'A soft, breathable everyday tee.' })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '32';

      render(<ProductDetail />);

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('A soft, breathable everyday tee.')).toBeInTheDocument();
    });

    it('renders nothing extra when description is empty', () => {
      productsMock = [makeProduct({ id: 33, name: 'Undescribed Product', description: '' })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '33';

      render(<ProductDetail />);

      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });

    it('renders size-chart rows for a well-formed sizeChart object', () => {
      productsMock = [makeProduct({
        id: 34,
        name: 'Sized Product',
        sizeChart: { Chest: '38-40in', Waist: '32-34in' },
      })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '34';

      render(<ProductDetail />);

      expect(screen.getByText('Size chart')).toBeInTheDocument();
      expect(screen.getByText('Chest')).toBeInTheDocument();
      expect(screen.getByText('38-40in')).toBeInTheDocument();
      expect(screen.getByText('Waist')).toBeInTheDocument();
      expect(screen.getByText('32-34in')).toBeInTheDocument();
    });

    it('does not crash and renders no size-chart section for a malformed (non-object) sizeChart value', () => {
      productsMock = [makeProduct({ id: 35, name: 'Malformed String Product', sizeChart: 'not an object' })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '35';

      expect(() => render(<ProductDetail />)).not.toThrow();
      expect(screen.getByText('Malformed String Product')).toBeInTheDocument();
      expect(screen.queryByText('Size chart')).not.toBeInTheDocument();
    });

    it('does not crash and renders no size-chart section for a null sizeChart value', () => {
      productsMock = [makeProduct({ id: 36, name: 'Null Size Chart Product', sizeChart: null })];
      fetchMatchGroupMock.mockResolvedValue([]);
      paramsId = '36';

      expect(() => render(<ProductDetail />)).not.toThrow();
      expect(screen.getByText('Null Size Chart Product')).toBeInTheDocument();
      expect(screen.queryByText('Size chart')).not.toBeInTheDocument();
    });
  });
});
