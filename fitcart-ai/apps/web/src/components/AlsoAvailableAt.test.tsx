import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '../data/products';
import AlsoAvailableAt from './AlsoAvailableAt';

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

describe('AlsoAvailableAt', () => {
  it('renders nothing when there is no match group', () => {
    const { container } = render(<AlsoAvailableAt members={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each match-group member with store, price and a link, plus the honest disclosure line', () => {
    const members = [
      makeProduct({ id: 2, store: 'Flipkart', price: 799, productUrl: 'https://www.flipkart.com/p/2' }),
      makeProduct({ id: 3, store: 'Myntra', price: 849, productUrl: 'https://www.myntra.com/p/3' }),
    ];
    render(<AlsoAvailableAt members={members} />);

    expect(screen.getByText('Also available at')).toBeInTheDocument();
    expect(screen.getAllByText('Flipkart').length).toBeGreaterThan(0);
    expect(screen.getByText(/₹799/)).toBeInTheDocument();
    expect(screen.getAllByText('Myntra').length).toBeGreaterThan(0);
    expect(screen.getByText(/₹849/)).toBeInTheDocument();

    const flipkartLink = screen.getByRole('link', { name: /view at flipkart/i });
    expect(flipkartLink).toHaveAttribute('href', 'https://www.flipkart.com/p/2');
    expect(flipkartLink).toHaveAttribute('target', '_blank');

    expect(screen.getByText('Manually confirmed to be the same product.')).toBeInTheDocument();

    // Explicit product decision: no confidence score or similarity badge.
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/match score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/similarity/i)).not.toBeInTheDocument();
  });

  it('does not render a link for a member with no productUrl, but still shows store and price', () => {
    const members = [makeProduct({ id: 4, store: 'AJIO', price: 599, productUrl: undefined })];
    render(<AlsoAvailableAt members={members} />);

    expect(screen.getByText(/AJIO/)).toBeInTheDocument();
    expect(screen.getByText(/₹599/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
