import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../data/products';

const navigateMock = vi.fn();
const showToastMock = vi.fn();
let locationState: { productId?: number | null } | null = null;
let productsMock: Product[] = [];

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: locationState }),
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({ products: productsMock, showToast: showToastMock }),
}));

vi.mock('../state/AuthState', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
}));

const { default: Result } = await import('./Result');

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

describe('Result', () => {
  afterEach(() => {
    navigateMock.mockReset();
    showToastMock.mockReset();
    locationState = null;
    productsMock = [];
  });

  it('falls back to the mock garment when no productId was forwarded (e.g. the upload-only flow)', () => {
    locationState = null;
    render(<Result />);

    expect(screen.getByText(/H&M Oversized Tee/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buy at Myntra/ })).toBeInTheDocument();
  });

  it('looks up and displays the real catalog product the try-on was for, given a forwarded productId', () => {
    productsMock = [makeProduct({ id: 42, name: 'Real Linen Shirt', store: 'Flipkart', price: 1299 })];
    locationState = { productId: 42 };

    render(<Result />);

    expect(screen.getByText(/Real Linen Shirt/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buy at Flipkart.*₹1,299/ })).toBeInTheDocument();
  });

  it('does not crash and falls back to the mock garment when the forwarded productId is not in the loaded catalog', () => {
    productsMock = [];
    locationState = { productId: 999 };

    render(<Result />);

    expect(screen.getByText(/H&M Oversized Tee/)).toBeInTheDocument();
  });

  it('forwards the same productId when re-rendering for another size', () => {
    productsMock = [makeProduct({ id: 7, name: 'Re-render Shirt' })];
    locationState = { productId: 7 };

    render(<Result />);
    fireEvent.click(screen.getByRole('button', { name: /try another size/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', { state: { afterRoute: '/result', productId: 7 } });
  });
});
