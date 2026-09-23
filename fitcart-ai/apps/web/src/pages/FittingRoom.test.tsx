import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FittingRoom from './FittingRoom';

describe('FittingRoom', () => {
  it('renders the landing page and advances from a valid product link', () => {
    vi.stubGlobal('scrollTo', vi.fn());
    render(<FittingRoom />);
    expect(screen.getByRole('heading', { name: /your next find.*your own mirror/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Paste a product link'), { target: { value: 'https://www.myntra.com/shirts/example' } });
    fireEvent.click(screen.getByRole('button', { name: /find product/i }));
    expect(screen.getByText('Product link added')).toBeInTheDocument();
    expect(screen.getByText('myntra.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^continue/i }));
    expect(screen.getByText(/does not return verified store comparisons/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try this on/i }));
    expect(screen.getByText('Meet your fitting room.')).toBeInTheDocument();
  });
});
