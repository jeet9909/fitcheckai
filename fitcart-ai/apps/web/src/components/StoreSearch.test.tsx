import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Marketplace, MarketplaceSearchResult, ProviderResult, StoreListing } from '../lib/api';
import type { Product } from '../data/products';

const searchMarketplacesMock = vi.fn();
const refreshProductsMock = vi.fn();
const showToastMock = vi.fn();
const navigateMock = vi.fn();

// Mutated per-test to simulate AppState's `products` — the persisted catalog
// a real/scraped search result gets matched against by product_url once
// runSearch's refreshProducts() call has resolved. Reset in afterEach so
// tests don't leak state into each other.
let productsMock: Product[] = [];

vi.mock('../lib/api', () => ({
  searchMarketplaces: searchMarketplacesMock,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({
    showToast: showToastMock,
    refreshProducts: refreshProductsMock,
    products: productsMock,
  }),
}));

const { default: StoreSearch } = await import('./StoreSearch');

function makeProduct(overrides: Partial<Product> & { id: number; productUrl: string }): Product {
  return {
    name: 'Persisted Shirt',
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
    confidence: 0.8,
    breakdown: [],
    source: 'live',
    imageUrl: undefined,
    sizeChart: undefined,
    ...overrides,
  };
}

function runSearch(query: string) {
  fireEvent.change(screen.getByPlaceholderText(/search amazon & flipkart/i), { target: { value: query } });
  fireEvent.click(screen.getByRole('button', { name: /search/i }));
}

// Mirrors the real backend contract (orchestrator.ts's resolveStores +
// index.ts) — a single-store request's response has `providers` containing
// ONLY that store's key, and `results` scoped to only that store's listings.
// Tests must model this per-call shape now that StoreSearch fires two
// independent single-store requests instead of one combined 'all' request.
function providerResponse(
  marketplace: 'amazon' | 'flipkart',
  provider: ProviderResult,
  listings: StoreListing[] = [],
  mock = false,
): MarketplaceSearchResult {
  return {
    query: 'shirt',
    mock,
    results: listings,
    providers: { [marketplace]: provider },
  };
}

// Wires the mock so each call to searchMarketplaces(query, marketplace)
// resolves independently according to the per-marketplace response supplied
// — the two calls StoreSearch fires are otherwise indistinguishable to a
// single mockResolvedValue().
function mockPerProvider(responses: Partial<Record<'amazon' | 'flipkart', MarketplaceSearchResult>>) {
  searchMarketplacesMock.mockImplementation(async (_query: string, marketplace: Marketplace) => {
    const response = responses[marketplace as 'amazon' | 'flipkart'];
    if (!response) throw new Error(`test did not stub a response for marketplace: ${marketplace}`);
    return response;
  });
}

describe('StoreSearch', () => {
  afterEach(() => {
    searchMarketplacesMock.mockReset();
    refreshProductsMock.mockReset();
    showToastMock.mockReset();
    navigateMock.mockReset();
    productsMock = [];
  });

  it('renders success and not_configured provider statuses as visually distinct chips', async () => {
    mockPerProvider({
      amazon: providerResponse('amazon', { status: 'success', count: 2, upserted: 2 }),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0, message: "Flipkart search isn't connected yet." }),
    });

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
    mockPerProvider({
      amazon: providerResponse('amazon', { status: 'error', count: 0, upserted: 0, message: 'boom' }),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    const errorChip = await screen.findByText('Amazon: search failed');
    expect(errorChip.style.background).toBe('var(--red-soft)');
  });

  it('renders a mock provider status distinctly and shows the demo banner', async () => {
    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'mock', count: 3, upserted: 3 },
        [
          // Realistic mock URL, matching what generateMockListings() actually
          // produces (see supabase/functions/search-products/mockData.ts) —
          // example.com, which can never pass the real Amazon domain
          // allowlist by design. A fake-but-allowlisted amazon.in URL here
          // would mask a bug where the allowlist gets applied to mock
          // listings and every demo result renders as "Link unavailable".
          { name: 'Demo Shirt', brand: 'DemoBrand', price: 500, mrp: 800, color: 'red', imageUrl: null, productUrl: 'https://example.com/mock-listing/amazon/amazon-1', store: 'Amazon', source: 'mock' },
        ],
        true,
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    const mockChip = await screen.findByText('Amazon: 3 demo results');
    expect(mockChip.style.background).toBe('var(--amber-soft)');

    expect(await screen.findByText(/showing demo data/i)).toBeInTheDocument();
    await waitFor(() => expect(refreshProductsMock).toHaveBeenCalled());

    // Mock listings must never render a functioning external link (their
    // productUrl is a fake example.com address) and must never offer a fake
    // try-on/explore path (mock data has no real image to try on) — just an
    // honest "Demo" indicator instead of any action button. They must also
    // never show up as "Link unavailable" (that phrasing is reserved for
    // real listings that failed the domain allowlist).
    expect(await screen.findByText('Demo — not a real product')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /see it on me/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Link unavailable')).not.toBeInTheDocument();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
  });

  it('offers an in-app "See it on me" try-on path and a subdued external store link for a real listing once it is matched to a persisted product', async () => {
    // Simulates the real production sequence: runSearch's refreshProducts()
    // call re-fetches the catalog, and the search result's listing shows up
    // there as a full Product (same product_url) with a real numeric id —
    // ListingRow looks this up by URL and routes to it exactly the way
    // ProductCard already does, reusing the same in-app flow with zero
    // duplication.
    productsMock = [makeProduct({ id: 42, productUrl: 'https://www.amazon.in/dp/real', name: 'Real Shirt' })];

    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'success', count: 1, upserted: 1 },
        [{ name: 'Real Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://www.amazon.in/dp/real', store: 'Amazon', source: 'live' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Real Shirt');

    // Primary action: in-app try-on, not the external store.
    const tryOnButton = screen.getByRole('button', { name: /see it on me/i });
    fireEvent.click(tryOnButton);
    expect(navigateMock).toHaveBeenCalledWith('/setup', { state: { productId: 42 } });

    // Clicking the listing itself (in-app explore) routes to the product
    // detail page, matching ProductCard's own image/name-click behavior.
    fireEvent.click(screen.getByText('Real Shirt'));
    expect(navigateMock).toHaveBeenCalledWith('/product/42');

    // The external store link is still available (final purchase step is
    // not removed) but stays clearly secondary — present, but not the only
    // or first thing offered.
    const buyLink = screen.getByRole('link', { name: /buy on amazon/i });
    expect(buyLink).toHaveAttribute('href', 'https://www.amazon.in/dp/real');
    expect(buyLink).toHaveAttribute('target', '_blank');
  });

  it('does not offer a try-on/explore path for a real listing before it has been matched to a persisted product yet, but still keeps the secondary store link', async () => {
    // productsMock intentionally left empty — simulates the transient window
    // between the search resolving and refreshProducts() finishing.
    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'success', count: 1, upserted: 1 },
        [{ name: 'Unmatched Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://www.amazon.in/dp/unmatched', store: 'Amazon', source: 'live' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Unmatched Shirt');
    expect(screen.queryByRole('button', { name: /see it on me/i })).not.toBeInTheDocument();
    expect(screen.getByText('Preparing in-app preview…')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /buy on amazon/i })).toHaveAttribute('href', 'https://www.amazon.in/dp/unmatched');
  });

  it('never renders a disallowed-domain result as a clickable link', async () => {
    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'success', count: 1, upserted: 1 },
        [{ name: 'Suspicious Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://scam.example.com/product', store: 'Amazon', source: 'live' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Suspicious Shirt');
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="https://scam.example.com/product"]')).toBeNull();
    expect(screen.getByText('Link unavailable')).toBeInTheDocument();
  });

  it('still applies the real-domain allowlist to non-mock (source !== "mock") listings', async () => {
    // Bug 2 regression guard: the allowlist bypass must be scoped strictly
    // to source === 'mock' — a live-sourced listing with a disallowed
    // domain must still be blocked, not just "any listing when mock mode is
    // on".
    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'success', count: 1, upserted: 1 },
        [{ name: 'Real Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://scam.example.com/product', store: 'Amazon', source: 'live' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

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
    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'error', count: 1, upserted: 0, message: 'Fetched results but failed to save them to the catalog.' },
        [{ name: 'Fetched Shirt', brand: 'BrandX', price: 100, mrp: 200, color: 'green', imageUrl: null, productUrl: 'https://www.amazon.in/dp/real', store: 'Amazon', source: 'live' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    expect(await screen.findByText('Fetched Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Amazon: search failed')).not.toBeInTheDocument();
    const chip = screen.getByText('Amazon: Fetched results but failed to save them to the catalog.');
    expect(chip).toBeInTheDocument();
    expect(chip.style.background).toBe('var(--amber-soft)');
  });

  it('still shows "search failed" for a provider error with zero results', async () => {
    mockPerProvider({
      amazon: providerResponse('amazon', { status: 'error', count: 0, upserted: 0, message: 'Search request to the upstream provider failed.' }),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

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

  it('renders a scrape_blocked provider status distinctly from error/not_configured, forwarding the backend message', async () => {
    mockPerProvider({
      amazon: providerResponse('amazon', { status: 'scrape_blocked', count: 0, upserted: 0, message: "Amazon isn't connected yet, and our scrape attempt was blocked by their bot detection." }),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    const chip = await screen.findByText("Amazon: Amazon isn't connected yet, and our scrape attempt was blocked by their bot detection.");
    expect(chip.style.background).toBe('var(--amber-soft)');
    // Must not collide with the wording used by 'error' or 'not_configured'.
    expect(screen.queryByText('Amazon: search failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Amazon: not connected yet')).not.toBeInTheDocument();
  });

  it('renders a scrape_failed provider status distinctly, forwarding the backend message', async () => {
    mockPerProvider({
      amazon: providerResponse('amazon', { status: 'scrape_failed', count: 0, upserted: 0, message: "Amazon isn't connected yet, and our scrape attempt hit an unexpected error." }),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    const chip = await screen.findByText("Amazon: Amazon isn't connected yet, and our scrape attempt hit an unexpected error.");
    expect(chip.style.background).toBe('var(--amber-soft)');
    expect(screen.queryByText('Amazon: search failed')).not.toBeInTheDocument();
  });

  it('renders a scraped listing with its own "Unofficial" badge (not the Demo badge), a working "See it on me" try-on path once matched, and still applies the real-domain allowlist to the secondary store link', async () => {
    productsMock = [makeProduct({ id: 7, productUrl: 'https://www.amazon.in/dp/scraped', name: 'Scraped Shirt' })];

    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'scrape_blocked', count: 1, upserted: 1 },
        [{ name: 'Scraped Shirt', brand: 'BrandX', price: 300, mrp: 500, color: 'blue', imageUrl: null, productUrl: 'https://www.amazon.in/dp/scraped', store: 'Amazon', source: 'scraped' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Scraped Shirt');
    expect(screen.getByText('Unofficial')).toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();

    // Primary in-app action available once matched to a persisted product.
    fireEvent.click(screen.getByRole('button', { name: /see it on me/i }));
    expect(navigateMock).toHaveBeenCalledWith('/setup', { state: { productId: 7 } });

    // Allowed real Amazon domain -> secondary store link still renders, subdued.
    const link = screen.getByRole('link', { name: /buy on amazon/i });
    expect(link).toHaveAttribute('href', 'https://www.amazon.in/dp/scraped');
  });

  it('does not exempt a scraped listing from the allowlist when its domain is disallowed', async () => {
    mockPerProvider({
      amazon: providerResponse(
        'amazon',
        { status: 'scrape_blocked', count: 1, upserted: 1 },
        [{ name: 'Scraped Scam Shirt', brand: 'BrandX', price: 300, mrp: 500, color: 'blue', imageUrl: null, productUrl: 'https://scam.example.com/product', store: 'Amazon', source: 'scraped' }],
      ),
      flipkart: providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }),
    });

    render(<StoreSearch />);
    runSearch('shirt');

    await screen.findByText('Scraped Scam Shirt');
    expect(screen.getByText('Unofficial')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
    expect(screen.getByText('Link unavailable')).toBeInTheDocument();
  });

  it('shows an animated spinner on the search button while searching and removes it once both providers complete', async () => {
    let resolveSearch: (value: MarketplaceSearchResult) => void = () => {};
    // Both calls resolve off the SAME promise instance here (mockReturnValue,
    // not per-provider mockImplementation) — deliberately simulating both
    // providers finishing at once, to prove the combined button spinner only
    // clears once every in-flight request has settled.
    searchMarketplacesMock.mockReturnValue(
      new Promise<MarketplaceSearchResult>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(<StoreSearch />);
    runSearch('shirt');

    expect(await screen.findByTestId('search-spinner')).toBeInTheDocument();
    expect(screen.getByText('Searching…')).toBeInTheDocument();

    resolveSearch({
      query: 'shirt',
      mock: false,
      results: [],
      providers: { amazon: { status: 'success', count: 0, upserted: 0 }, flipkart: { status: 'not_configured', count: 0, upserted: 0 } },
    });

    await waitFor(() => expect(screen.queryByTestId('search-spinner')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('renders Amazon\'s result and chip before Flipkart resolves, proving the two requests are independent (core fix)', async () => {
    // This is the regression test for the actual production bug: a combined
    // `marketplace: 'all'` request meant the whole panel waited for
    // max(Amazon, Flipkart) — here Amazon resolves immediately and Flipkart
    // is held open indefinitely until the test explicitly resolves it, so we
    // can assert Amazon is already visible in the DOM while Flipkart is
    // provably still in flight.
    let resolveFlipkart: (value: MarketplaceSearchResult) => void = () => {};
    const flipkartPromise = new Promise<MarketplaceSearchResult>((resolve) => {
      resolveFlipkart = resolve;
    });

    searchMarketplacesMock.mockImplementation(async (_query: string, marketplace: Marketplace) => {
      if (marketplace === 'amazon') {
        return providerResponse(
          'amazon',
          { status: 'success', count: 1, upserted: 1 },
          [{ name: 'Fast Amazon Shirt', brand: 'BrandX', price: 400, mrp: 600, color: 'blue', imageUrl: null, productUrl: 'https://www.amazon.in/dp/fast', store: 'Amazon', source: 'live' }],
        );
      }
      return flipkartPromise;
    });

    render(<StoreSearch />);
    runSearch('shirt');

    // Amazon's fast response renders on its own — chip and listing row —
    // without waiting for Flipkart.
    expect(await screen.findByText('Amazon: 1 result')).toBeInTheDocument();
    expect(await screen.findByText('Fast Amazon Shirt')).toBeInTheDocument();

    // Proof this is genuinely progressive (not "both eventually appear"):
    // at this exact point Flipkart's own promise has NOT been resolved yet,
    // Flipkart's chip is still showing its independent loading state, and
    // the combined search button is still mid-search — all while Amazon's
    // result is already visible.
    expect(screen.getByTestId('search-spinner-flipkart')).toBeInTheDocument();
    expect(screen.queryByText('Flipkart: not connected yet')).not.toBeInTheDocument();
    expect(screen.getByText('Searching…')).toBeInTheDocument();

    resolveFlipkart(providerResponse('flipkart', { status: 'not_configured', count: 0, upserted: 0 }));

    await waitFor(() => expect(screen.queryByTestId('search-spinner-flipkart')).not.toBeInTheDocument());
    expect(await screen.findByText('Flipkart: not connected yet')).toBeInTheDocument();
    // Amazon's result is still there, unaffected by Flipkart resolving later.
    expect(screen.getByText('Fast Amazon Shirt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('renders Amazon\'s result even when the Flipkart request throws a network-level error', async () => {
    let rejectFlipkart: (err: Error) => void = () => {};
    const flipkartPromise = new Promise<MarketplaceSearchResult>((_resolve, reject) => {
      rejectFlipkart = reject;
    });

    searchMarketplacesMock.mockImplementation(async (_query: string, marketplace: Marketplace) => {
      if (marketplace === 'amazon') {
        return providerResponse(
          'amazon',
          { status: 'success', count: 1, upserted: 1 },
          [{ name: 'Resilient Amazon Shirt', brand: 'BrandX', price: 250, mrp: 400, color: 'black', imageUrl: null, productUrl: 'https://www.amazon.in/dp/resilient', store: 'Amazon', source: 'live' }],
        );
      }
      return flipkartPromise;
    });

    render(<StoreSearch />);
    runSearch('shirt');

    expect(await screen.findByText('Resilient Amazon Shirt')).toBeInTheDocument();

    rejectFlipkart(new Error('network down'));

    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith('Could not reach Flipkart search — try again'));
    // Amazon's already-rendered result must survive Flipkart's throw.
    expect(screen.getByText('Resilient Amazon Shirt')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument());
  });
});
