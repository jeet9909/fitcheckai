import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../data/products';
import { findSimilarProducts } from '../lib/similarProducts';

const navigateMock = vi.fn();
const toggleSaveMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({ savedProductIds: [], toggleSave: toggleSaveMock }),
}));

const { default: SimilarProducts } = await import('./SimilarProducts');

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

describe('findSimilarProducts', () => {
  it('excludes the current product and items from other buckets', () => {
    const current = makeProduct({ id: 1, bucket: 'Clothing', price: 500 });
    const all = [
      current,
      makeProduct({ id: 2, bucket: 'Clothing', price: 480 }),
      makeProduct({ id: 3, bucket: 'Shoes', price: 500 }),
    ];

    const result = findSimilarProducts(current, all);

    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it('sorts by price proximity to the current product, closest first', () => {
    const current = makeProduct({ id: 1, bucket: 'Clothing', price: 500 });
    const far = makeProduct({ id: 2, bucket: 'Clothing', price: 100 });
    const close = makeProduct({ id: 3, bucket: 'Clothing', price: 520 });
    const mid = makeProduct({ id: 4, bucket: 'Clothing', price: 350 });
    const all = [current, far, close, mid];

    const result = findSimilarProducts(current, all);

    expect(result.map((p) => p.id)).toEqual([3, 4, 2]);
  });

  it('caps the result at 8 items', () => {
    const current = makeProduct({ id: 1, bucket: 'Clothing', price: 500 });
    const all = [current, ...Array.from({ length: 12 }, (_, i) => makeProduct({ id: i + 2, bucket: 'Clothing', price: 500 + i }))];

    const result = findSimilarProducts(current, all);

    expect(result).toHaveLength(8);
  });

  it('returns an empty array when nothing else shares the bucket', () => {
    const current = makeProduct({ id: 1, bucket: 'Clothing', price: 500 });
    const all = [current, makeProduct({ id: 2, bucket: 'Shoes', price: 500 })];

    expect(findSimilarProducts(current, all)).toEqual([]);
  });
});

describe('SimilarProducts component', () => {
  it('renders nothing when there are no similar products', () => {
    const current = makeProduct({ id: 1, bucket: 'Clothing', price: 500 });
    const { container } = render(<SimilarProducts product={current} allProducts={[current]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a heading and a card per similar product', () => {
    const current = makeProduct({ id: 1, bucket: 'Clothing', price: 500, name: 'Current Shirt' });
    const other = makeProduct({ id: 2, bucket: 'Clothing', price: 480, name: 'Other Shirt' });
    render(<SimilarProducts product={current} allProducts={[current, other]} />);

    expect(screen.getByText('Similar products')).toBeInTheDocument();
    expect(screen.getByText('Other Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Current Shirt')).not.toBeInTheDocument();
  });
});
