import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../data/products';

const navigateMock = vi.fn();
const toggleSaveMock = vi.fn();
let productsMock: Product[] = [];
let savedProductIdsMock: number[] = [];
let userMock: { id: string } | null = null;
let supabaseMock: any = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({
    products: productsMock,
    savedProductIds: savedProductIdsMock,
    toggleSave: toggleSaveMock,
  }),
}));

vi.mock('../state/AuthState', () => ({
  useAuth: () => ({ user: userMock }),
}));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return supabaseMock;
  },
}));

const { default: Saved } = await import('./Saved');

describe('Saved', () => {
  afterEach(() => {
    navigateMock.mockReset();
    toggleSaveMock.mockReset();
    productsMock = [];
    savedProductIdsMock = [];
    userMock = null;
    supabaseMock = null;
  });

  it('shows the honest empty state, not fabricated rows, for a guest (no user)', () => {
    userMock = null;
    supabaseMock = null;

    render(<Saved />);

    expect(screen.getByText('Size memory')).toBeInTheDocument();
    expect(screen.getByText(/no size history yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Levi's")).not.toBeInTheDocument();
    expect(screen.queryByText('H&M')).not.toBeInTheDocument();
    expect(screen.queryByText('Zara')).not.toBeInTheDocument();
  });

  it('shows the honest empty state, not fabricated rows, for a signed-in user with no real size_memory rows', async () => {
    userMock = { id: 'user-1' };
    const eqMock = vi.fn().mockResolvedValue({ data: [] });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    supabaseMock = { from: fromMock };

    render(<Saved />);

    await waitFor(() => expect(fromMock).toHaveBeenCalledWith('size_memory'));
    expect(screen.getByText(/no size history yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Levi's")).not.toBeInTheDocument();
    expect(screen.queryByText('H&M')).not.toBeInTheDocument();
    expect(screen.queryByText('Zara')).not.toBeInTheDocument();
  });

  it('shows the real rows for a signed-in user with real size_memory data from Supabase', async () => {
    userMock = { id: 'user-2' };
    const realRows = [
      { brand: 'Uniqlo', size: 'S', note: 'True to size' },
      { brand: 'Nike', size: 'M', note: 'Runs small' },
    ];
    const eqMock = vi.fn().mockResolvedValue({ data: realRows });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    supabaseMock = { from: fromMock };

    render(<Saved />);

    expect(await screen.findByText('Uniqlo')).toBeInTheDocument();
    expect(screen.getByText('Nike')).toBeInTheDocument();
    expect(screen.queryByText(/no size history yet/i)).not.toBeInTheDocument();
  });
});
