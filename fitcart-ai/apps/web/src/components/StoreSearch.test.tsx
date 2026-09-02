import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketplaceSearchResult } from '../lib/api';

const searchMarketplacesMock = vi.fn();
const refreshProductsMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('../lib/api', () => ({
  searchMarketplaces: searchMarketplacesMock,
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({
    showToast: showToastMock,
    refreshProducts: refreshProductsMock,
  }),
}));

const { default: StoreSearch } = await import('./StoreSearch');

function runSearch(query: string) {
  fireEvent.change(screen.getByPlaceholderText(/search amazon & flipkart/i), { target: { value: query } });
  fireEvent.click(screen.getByRole('button', { name: /search/i }));
}

describe('StoreSearch', () => {
  afterEach(() => {
    searchMarketplacesMock.mockReset();
    refreshProductsMock.mockReset();
    showToastMock.mockReset();
  });

  it('renders success and not_configured provider statuses as visually distinct chips', async () => {
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: false,
      results: [],
      providers: {
        amazon: { status: 'success', count: 2, upserted: 2 },
        flipkart: { status: 'not_configured', count: 0, upserted: 0, message: "Flipkart search isn't connected yet." },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    const successChip = await screen.findByText('Amazon: 2 results');
    const notConfiguredChip = await screen.findByText('Flipkart: not connected yet');

    expect(successChip.style.background).not.toBe(notConfiguredChip.style.background);
    expect(successChip.style.background).toBe('var(--teal-soft)');
    expect(notConfiguredChip.style.background).toBe('var(--surface-alt)');
    expect(refreshProductsMock).not.toHaveBeenCalled();
  });

  it('renders an error provider status distinctly', async () => {
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: false,
      results: [],
      providers: {
        amazon: { status: 'error', count: 0, upserted: 0, message: 'boom' },
        flipkart: { status: 'not_configured', count: 0, upserted: 0 },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    const errorChip = await screen.findByText('Amazon: search failed');
    expect(errorChip.style.background).toBe('var(--red-soft)');
  });

  it('renders a mock provider status distinctly and shows the demo banner', async () => {
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: true,
      results: [
        // Realistic mock URL, matching what generateMockListings() actually
        // produces (see supabase/functions/search-products/mockData.ts) —
        // example.com, which can never pass the real Amazon domain
        // allowlist by design. A fake-but-allowlisted amazon.in URL here
        // would mask a bug where the allowlist gets applied to mock
        // listings and every demo result renders as "Link unavailable".
        { name: 'Demo Shirt', brand: 'DemoBrand', price: 500, mrp: 800, color: 'red', imageUrl: null, productUrl: 'https://example.com/mock-listing/amazon/amazon-1', store: 'Amazon', source: 'mock' },
      ],
      providers: {
        amazon: { status: 'mock', count: 3, upserted: 3 },
        flipkart: { status: 'not_configured', count: 0, upserted: 0 },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    const mockChip = await screen.findByText('Amazon: 3 demo results');
    expect(mockChip.style.background).toBe('var(--amber-soft)');

    expect(await screen.findByText(/showing demo data/i)).toBeInTheDocument();
    await waitFor(() => expect(refreshProductsMock).toHaveBeenCalled());

    // Bug 2 regression: mock listings must bypass the real-domain allowlist
    // and render as a working, clearly-tagged (Demo) link — not
    // "Link unavailable" — even though their URL is on example.com.
    const demoLink = await screen.findByRole('link', { name: /view/i });
    expect(demoLink).toHaveAttribute('href', 'https://example.com/mock-listing/amazon/amazon-1');
    expect(screen.queryByText('Link unavailable')).not.toBeInTheDocument();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
  });

  it('never renders a disallowed-domain result as a clickable link', async () => {
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: false,
      results: [
        { name: 'Suspicious Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://scam.example.com/product', store: 'Amazon', source: 'live' },
      ],
      providers: {
        amazon: { status: 'success', count: 1, upserted: 1 },
        flipkart: { status: 'not_configured', count: 0, upserted: 0 },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Suspicious Shirt');
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="https://scam.example.com/product"]')).toBeNull();
    expect(screen.getByText('Link unavailable')).toBeInTheDocument();
  });

  it('still applies the real-domain allowlist to non-mock (source !== "mock") listings, even with mock results also present', async () => {
    // Bug 2 regression guard: the allowlist bypass must be scoped strictly
    // to source === 'mock' — a live-sourced listing with a disallowed
    // domain must still be blocked, not just "any listing when mock mode is
    // on".
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: false,
      results: [
        { name: 'Real Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://scam.example.com/product', store: 'Amazon', source: 'live' },
      ],
      providers: {
        amazon: { status: 'success', count: 1, upserted: 1 },
        flipkart: { status: 'not_configured', count: 0, upserted: 0 },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Real Shirt');
    expect(screen.getByText('Link unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
  });

  it('shows a "not saved" warning, not "search failed", when a provider errors after fetching results (Bug 3)', async () => {
    // Reproduces the orchestrator/index.ts case where the upstream fetch
    // succeeded (count > 0) but the DB upsert failed, downgrading status to
    // 'error' with a specific message — the chip must not claim the search
    // failed when results are visibly rendered below it.
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: false,
      results: [
        { name: 'Fetched Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://www.amazon.in/dp/real', store: 'Amazon', source: 'live' },
      ],
      providers: {
        amazon: { status: 'error', count: 1, upserted: 0, message: 'Fetched results but failed to save them to the catalog.' },
        flipkart: { status: 'not_configured', count: 0, upserted: 0 },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    expect(await screen.findByText('Fetched Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Amazon: search failed')).not.toBeInTheDocument();
    const chip = screen.getByText('Amazon: Fetched results but failed to save them to the catalog.');
    expect(chip).toBeInTheDocument();
    expect(chip.style.background).toBe('var(--amber-soft)');
  });

  it('still shows "search failed" for a provider error with zero results', async () => {
    const result: MarketplaceSearchResult = {
      query: 'shirt',
      mock: false,
      results: [],
      providers: {
        amazon: { status: 'error', count: 0, upserted: 0, message: 'Search request to the upstream provider failed.' },
        flipkart: { status: 'not_configured', count: 0, upserted: 0 },
      },
    };
    searchMarketplacesMock.mockResolvedValue(result);

    render(<StoreSearch />);
    runSearch('shirt');

    const errorChip = await screen.findByText('Amazon: search failed');
    expect(errorChip.style.background).toBe('var(--red-soft)');
  });

  it('has a maxLength of 200 on the search input, matching the backend query limit', () => {
    render(<StoreSearch />);
    const input = screen.getByPlaceholderText(/search amazon & flipkart/i);
    expect(input).toHaveAttribute('maxlength', '200');
  });
});
