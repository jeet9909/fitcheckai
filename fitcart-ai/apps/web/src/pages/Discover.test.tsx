import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../data/products';

const navigateMock = vi.fn();
const toggleSaveMock = vi.fn();
const showToastMock = vi.fn();

let searchQueryMock = '';
let productsMock: Product[] = [];
let savedProductIdsMock: number[] = [];

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({
    products: productsMock,
    searchQuery: searchQueryMock,
    savedProductIds: savedProductIdsMock,
    toggleSave: toggleSaveMock,
    showToast: showToastMock,
  }),
}));

// StoreSearch is a large, independently-tested live-search widget (see
// StoreSearch.test.tsx) that pulls in ../lib/api — stubbed out here so this
// file can focus purely on Discover's own filtering/sorting/summary logic.
vi.mock('../components/StoreSearch', () => ({
  default: () => <div data-testid="store-search-stub" />,
}));

const { default: Discover } = await import('./Discover');

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

describe('Discover', () => {
  afterEach(() => {
    navigateMock.mockReset();
    toggleSaveMock.mockReset();
    showToastMock.mockReset();
    searchQueryMock = '';
    productsMock = [];
    savedProductIdsMock = [];
  });

  it('shows the literal search query and an interpretation summary built only from fields queryIntent actually parsed', () => {
    searchQueryMock = 'Black oversized T-shirt under ₹1,000';
    productsMock = [
      makeProduct({ id: 1, name: 'Oversized Tee', category: 'T-shirt', color: 'black', price: 800 }),
      makeProduct({ id: 2, name: 'Slim Jeans', category: 'Jeans', color: 'blue', price: 1500 }),
    ];

    render(<Discover />);

    expect(screen.getByText('“Black oversized T-shirt under ₹1,000”')).toBeInTheDocument();
    expect(screen.getByText(/FitCart read that as: colour black, fit oversized, category t-shirt, price under ₹1,000\. 1 match\./)).toBeInTheDocument();
    expect(screen.getByText('Oversized Tee')).toBeInTheDocument();
    expect(screen.queryByText('Slim Jeans')).not.toBeInTheDocument();
  });

  it('omits the "you asked for" block entirely when there is no search query', () => {
    productsMock = [makeProduct({ id: 1 })];
    render(<Discover />);
    expect(screen.queryByText('You asked for')).not.toBeInTheDocument();
  });

  it('filters by retailer via multi-select checkboxes', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Amazon Item', store: 'Amazon' }),
      makeProduct({ id: 2, name: 'Flipkart Item', store: 'Flipkart' }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Flipkart' }));

    expect(screen.queryByText('Amazon Item')).not.toBeInTheDocument();
    expect(screen.getByText('Flipkart Item')).toBeInTheDocument();
  });

  it('filters by a real price bucket', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Cheap Item', price: 300 }),
      makeProduct({ id: 2, name: 'Expensive Item', price: 6000 }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Under ₹500' }));

    expect(screen.getByText('Cheap Item')).toBeInTheDocument();
    expect(screen.queryByText('Expensive Item')).not.toBeInTheDocument();
  });

  it('filters by colour using the real product.color field', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Green Item', color: 'green' }),
      makeProduct({ id: 2, name: 'Red Item', color: 'red' }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Red' }));

    expect(screen.queryByText('Green Item')).not.toBeInTheDocument();
    expect(screen.getByText('Red Item')).toBeInTheDocument();
  });

  it('normalizes gray/grey spelling variants into a single colour checkbox and filters both', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Gray Spelled Item', color: 'gray' }),
      makeProduct({ id: 2, name: 'Grey Spelled Item', color: 'grey' }),
      makeProduct({ id: 3, name: 'Red Item', color: 'red' }),
    ];
    render(<Discover />);

    expect(screen.getAllByRole('checkbox', { name: 'Grey' })).toHaveLength(1);
    expect(screen.queryByRole('checkbox', { name: 'Gray' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Grey' }));

    expect(screen.getByText('Gray Spelled Item')).toBeInTheDocument();
    expect(screen.getByText('Grey Spelled Item')).toBeInTheDocument();
    expect(screen.queryByText('Red Item')).not.toBeInTheDocument();
  });

  it('filters by fit using a keyword heuristic against name/category, not a real fit field', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Oversized Hoodie', category: 'Hoodie' }),
      makeProduct({ id: 2, name: 'Slim Fit Shirt', category: 'Shirt' }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Oversized' }));

    expect(screen.getByText('Oversized Hoodie')).toBeInTheDocument();
    expect(screen.queryByText('Slim Fit Shirt')).not.toBeInTheDocument();
  });

  it('the "Try-on available only" toggle uses the same real signal as ProductDetail (breakdown.length > 0)', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Has Fit Data', breakdown: [{ label: 'Chest', value: 'Good', tone: 'good' }] }),
      makeProduct({ id: 2, name: 'No Fit Data', breakdown: [] }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: /try-on available only/i }));

    expect(screen.getByText('Has Fit Data')).toBeInTheDocument();
    expect(screen.queryByText('No Fit Data')).not.toBeInTheDocument();
  });

  it('sorts by best price first using the real price field', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Pricier', price: 900 }),
      makeProduct({ id: 2, name: 'Cheaper', price: 100 }),
    ];
    render(<Discover />);

    const names = screen.getAllByText(/Pricier|Cheaper/).map((el) => el.textContent);
    expect(names[0]).toBe('Cheaper');
    expect(names[1]).toBe('Pricier');
  });

  it('sorts by best rated using ratingFromFitScore, not a fabricated rating', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Lower Fit', fitScore: 40, price: 100 }),
      makeProduct({ id: 2, name: 'Higher Fit', fitScore: 95, price: 200 }),
    ];
    render(<Discover />);

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'rating' } });

    const names = screen.getAllByText(/Lower Fit|Higher Fit/).map((el) => el.textContent);
    expect(names[0]).toBe('Higher Fit');
    expect(names[1]).toBe('Lower Fit');
  });

  it('renders a cosmetic-only note for the Size filter and never hides products based on it', () => {
    productsMock = [makeProduct({ id: 1, name: 'Any Size Item' })];
    render(<Discover />);

    fireEvent.click(screen.getByRole('button', { name: 'M' }));

    expect(screen.getByText('Any Size Item')).toBeInTheDocument();
  });

  it('"Add to compare" is a local-state stub that toggles a visual state and shows a toast, without a real compare page', () => {
    productsMock = [makeProduct({ id: 1, name: 'Comparable Item' })];
    render(<Discover />);

    const compareButton = screen.getByRole('button', { name: 'Add to compare' });
    fireEvent.click(compareButton);

    expect(screen.getByRole('button', { name: 'Added to compare' })).toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith('Added Comparable Item to compare');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows an end-of-results nudge with a real price label when a price filter narrows results down small', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Cheap A', price: 200 }),
      makeProduct({ id: 2, name: 'Expensive B', price: 6000 }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Under ₹500' }));

    expect(screen.getByText(/That is everything under ₹500\./)).toBeInTheDocument();
  });

  it('"Try a broader search" clears filters and restores the full catalog', () => {
    productsMock = [
      makeProduct({ id: 1, name: 'Cheap A', price: 200 }),
      makeProduct({ id: 2, name: 'Expensive B', price: 6000 }),
    ];
    render(<Discover />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Under ₹500' }));
    expect(screen.queryByText('Expensive B')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try a broader search' }));

    expect(screen.getByText('Expensive B')).toBeInTheDocument();
  });

  it('renders a category-templated FAQ block when a category is parsed from the query', () => {
    searchQueryMock = 'black t-shirt';
    productsMock = [makeProduct({ id: 1, name: 'Black Tee', category: 'T-shirt', color: 'black' })];
    render(<Discover />);

    expect(screen.getByText('What counts as an oversized fit?')).toBeInTheDocument();
  });

  it('falls back to the generic FAQ set when no category is parsed', () => {
    productsMock = [makeProduct({ id: 1 })];
    render(<Discover />);

    expect(screen.getByText('How does try-on work?')).toBeInTheDocument();
  });
});
