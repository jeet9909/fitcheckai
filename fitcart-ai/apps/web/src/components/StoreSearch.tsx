import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchMarketplaces, type ProviderResult, type ProviderStatus, type StoreListing } from '../lib/api';
import { isAllowedMarketplaceUrl } from '../lib/marketplaceUrls';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import type { Product } from '../data/products';

type ProviderKey = 'amazon' | 'flipkart';

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
};

const PROVIDER_ORDER: ProviderKey[] = ['amazon', 'flipkart'];

// Amazon and Flipkart are now fetched as two fully independent requests (see
// runSearch below) instead of one combined `marketplace: 'all'` request —
// the backend runs both providers concurrently either way, but a combined
// request's HTTP response only comes back once BOTH finish, so a fast
// provider's result was previously held hostage by a slow one. Each slot
// tracks its own request lifecycle so its chip/results can render the moment
// THAT provider resolves, independent of the other.
interface ProviderSlot {
  status: 'idle' | 'loading' | 'done';
  data?: ProviderResult;
  listings: StoreListing[];
}

function idleSlot(): ProviderSlot {
  return { status: 'idle', listings: [] };
}

function loadingSlot(): ProviderSlot {
  return { status: 'loading', listings: [] };
}

function statusChipStyle(status: ProviderStatus, count: number): { background: string; color: string } {
  switch (status) {
    case 'success':
      return { background: 'var(--teal-soft)', color: 'var(--teal)' };
    case 'mock':
      return { background: 'var(--amber-soft)', color: 'var(--amber-text)' };
    case 'error':
      // Results are present (only the DB save failed) — treat this as a
      // warning, not the alarming red used for a true zero-result failure.
      if (count > 0) return { background: 'var(--amber-soft)', color: 'var(--amber-text)' };
      return { background: 'var(--red-soft)', color: 'var(--red)' };
    case 'scrape_blocked':
    case 'scrape_failed':
      // The real API isn't configured AND a best-effort scraping fallback
      // was attempted but didn't fully work — an honest partial-failure,
      // same amber warning tone as the "results present but not saved" case
      // above, distinct from the neutral grey not_configured and the red
      // zero-result error.
      return { background: 'var(--amber-soft)', color: 'var(--amber-text)' };
    case 'not_configured':
    default:
      return { background: 'var(--surface-alt)', color: 'var(--ink-faint)' };
  }
}

function statusChipLabel(name: string, status: ProviderStatus, count: number, message?: string): string {
  switch (status) {
    case 'success':
      return count === 0 ? `${name}: no results` : `${name}: ${count} result${count === 1 ? '' : 's'}`;
    case 'mock':
      return count === 0 ? `${name}: no demo results` : `${name}: ${count} demo result${count === 1 ? '' : 's'}`;
    case 'error':
      // The backend can return status 'error' with count > 0 when listings
      // were fetched successfully but only the DB upsert step failed (see
      // index.ts's upsertAndReport). In that case results are genuinely
      // present and rendered below this chip, so claiming the search
      // "failed" would be self-contradictory — surface the real reason
      // instead.
      if (count > 0) {
        return message ? `${name}: ${message}` : `${name}: showing results, not saved`;
      }
      return `${name}: search failed`;
    case 'scrape_blocked':
    case 'scrape_failed':
      // The backend's message already states both facts honestly (not
      // connected via the real API + what happened with the scrape
      // fallback) — forward it verbatim rather than inventing new generic
      // copy that could drift from what actually happened.
      return message ? `${name}: ${message}` : `${name}: not connected yet`;
    case 'not_configured':
    default:
      return `${name}: not connected yet`;
  }
}

function ListingRow({ listing, matchedProduct }: { listing: StoreListing; matchedProduct?: Product }) {
  const navigate = useNavigate();
  const isMock = listing.source === 'mock';
  const isScraped = listing.source === 'scraped';
  // Mock listings deliberately point at example.com (see mockData.ts) and
  // are never expected to pass the real Amazon/Flipkart domain allowlist —
  // the backend's own `filterAllowedListings` skips them for the same
  // reason. Applying the real-domain allowlist to them here would make
  // every demo result look broken ("Link unavailable"). They're always
  // visually tagged "Demo" (below) so a demo link can never be confused
  // with a real one. Scraped listings point at REAL store URLs (unlike
  // mock's fake example.com), so they get NO exemption — they go through
  // the allowlist exactly like live listings.
  const allowed = isMock || isAllowedMarketplaceUrl(listing.store, listing.productUrl);

  // A real/scraped listing only gets a working in-app explore/try-on path
  // once its matching row has actually been persisted (via runSearch's
  // refreshProducts() call, matched back here by product_url) and picked up
  // into AppState's `products` — see StoreSearch's mergedResults mapping.
  // Mock listings are never persisted (index.ts's upsertAndReport skips
  // source: 'mock') and have no real image worth trying on, so they never
  // get this path regardless of matching.
  const canExplore = !isMock && allowed && !!matchedProduct;

  const goToDetail = () => {
    if (matchedProduct) navigate(`/product/${matchedProduct.id}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--surface)' }}>
      <div
        onClick={canExplore ? goToDetail : undefined}
        role={canExplore ? 'button' : undefined}
        tabIndex={canExplore ? 0 : undefined}
        onKeyDown={canExplore ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDetail(); } } : undefined}
        aria-label={canExplore ? `View ${listing.name} details` : undefined}
        style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-alt)', flexShrink: 0, cursor: canExplore ? 'pointer' : 'default' }}
      >
        {listing.imageUrl && (
          <img src={listing.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            onClick={canExplore ? goToDetail : undefined}
            style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: canExplore ? 'pointer' : 'default' }}
          >
            {listing.name}
          </span>
          {isMock && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--amber-text)', background: 'var(--amber-soft)', borderRadius: 5, padding: '1px 6px' }}>Demo</span>
          )}
          {isScraped && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--info)', background: 'var(--info-soft)', borderRadius: 5, padding: '1px 6px' }}>Unofficial</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{listing.brand} · {listing.store}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(listing.price)}</div>

        {isMock ? (
          // Mock data has no real image or store page worth trying on or
          // buying from — no action button, just an honest label so the row
          // doesn't look broken (no dead/fake link either).
          <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Demo — not a real product</span>
        ) : !allowed ? (
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }} title="Link unavailable">Link unavailable</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {matchedProduct ? (
              <button
                type="button"
                onClick={() => navigate('/setup', { state: { productId: matchedProduct.id } })}
                style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, padding: '8px 14px', borderRadius: 7, cursor: 'pointer', minHeight: 32 }}
              >
                See it on me
              </button>
            ) : (
              // The listing was just returned by the search and is being
              // upserted server-side (see runSearch's refreshProducts()
              // call) — until it shows up in the catalog with a real id,
              // there's no product id to route /product/:id or /setup to
              // yet. This is expected to resolve within one refresh, not a
              // permanent state.
              <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Preparing in-app preview…</span>
            )}
            {/* Secondary, deliberately subdued and spaced well clear of the
                primary button above (a cramped gap here was getting
                mis-tapped for "See it on me" on mobile) — the real store is
                the actual final purchase step (not removed), but it must
                never be the first, loudest, or accidentally-tapped action a
                search result offers. */}
            <a
              href={listing.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 9.5, color: 'var(--ink-faint)', fontWeight: 500, opacity: 0.75, marginTop: 2 }}
            >
              Buy on {listing.store} ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoreSearch() {
  const { showToast, refreshProducts, products } = useAppState();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mockActive, setMockActive] = useState(false);
  const [providerStates, setProviderStates] = useState<Record<ProviderKey, ProviderSlot>>({
    amazon: idleSlot(),
    flipkart: idleSlot(),
  });

  const runSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || searching) return;

    setSearching(true);
    setMockActive(false);
    setProviderStates({ amazon: loadingSlot(), flipkart: loadingSlot() });

    // Two fully independent requests, NOT Promise.all — each provider's slot
    // updates the instant its own promise settles, so a fast Amazon response
    // renders immediately even while a slow Flipkart scrape is still
    // in flight. A throw from one provider's request (network failure, not
    // just a well-formed error body) is caught right here, per-provider, so
    // it can never block or blank out the other provider's result.
    let pending = PROVIDER_ORDER.length;
    const settleOne = () => {
      pending -= 1;
      if (pending === 0) setSearching(false);
    };

    for (const key of PROVIDER_ORDER) {
      searchMarketplaces(trimmed, key)
        .then((res) => {
          setProviderStates((prev) => ({
            ...prev,
            [key]: { status: 'done', data: res.providers[key], listings: res.results },
          }));
          if (res.mock) setMockActive(true);
          if (res.results.length > 0) refreshProducts();
        })
        .catch(() => {
          showToast(`Could not reach ${PROVIDER_LABELS[key]} search — try again`);
          setProviderStates((prev) => ({
            ...prev,
            [key]: {
              status: 'done',
              data: { status: 'error', count: 0, upserted: 0, message: 'Could not reach the server.' },
              listings: [],
            },
          }));
        })
        .finally(settleOne);
    }
  };

  const hasSearched = providerStates.amazon.status !== 'idle' || providerStates.flipkart.status !== 'idle';
  const mergedResults = PROVIDER_ORDER.flatMap((key) => providerStates[key].listings);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          disabled={searching}
          maxLength={200}
          placeholder="Search Amazon & Flipkart, e.g. men's shirt"
          aria-label="Search live listings across marketplaces"
          style={{ flex: '1 1 240px', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: 'var(--surface)' }}
        />
        <button
          onClick={runSearch}
          disabled={searching || !query.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 8, opacity: searching || !query.trim() ? 0.6 : 1 }}
        >
          {searching && <span className="fc-spinner" data-testid="search-spinner" aria-hidden="true" />}
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {mockActive && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-soft)', color: 'var(--amber-text)',
            border: '1px solid var(--amber)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600,
          }}
        >
          <span aria-hidden="true">⚠</span>
          Showing demo data — these results are simulated, not live marketplace listings.
        </div>
      )}

      {hasSearched && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROVIDER_ORDER.map((key) => {
            const slot = providerStates[key];
            const label = PROVIDER_LABELS[key];

            // Each provider's own chip shows its own loading state
            // independently — a fast Amazon response must render the moment
            // it resolves, without waiting for a still-spinning Flipkart.
            if (slot.status === 'loading') {
              return (
                <span
                  key={key}
                  className="fc-chip"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-alt)', color: 'var(--ink-faint)' }}
                >
                  <span className="fc-spinner" data-testid={`search-spinner-${key}`} aria-hidden="true" />
                  {label}: searching…
                </span>
              );
            }

            const provider = slot.data;
            if (!provider) return null;
            const style = statusChipStyle(provider.status, provider.count);
            return (
              <span
                key={key}
                className="fc-chip"
                title={provider.message}
                style={{ background: style.background, color: style.color }}
              >
                {statusChipLabel(label, provider.status, provider.count, provider.message)}
              </span>
            );
          })}
        </div>
      )}

      {mergedResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mergedResults.map((listing, i) => {
            // Mock listings are never persisted (see index.ts's
            // upsertAndReport), so a URL match would be coincidental at
            // best — skip the lookup entirely for them. Real/scraped
            // listings that passed the backend's own allowlist get upserted
            // into `products`; once refreshProducts() (called above, in
            // runSearch) resolves, the matching row shows up here by its
            // real product_url, giving ListingRow a stable numeric id to
            // route /product/:id and /setup to — the exact same in-app flow
            // ProductCard already uses, with no parallel identity system.
            const matchedProduct = listing.source === 'mock'
              ? undefined
              : products.find((p) => p.productUrl === listing.productUrl);
            return <ListingRow key={`${listing.productUrl}-${i}`} listing={listing} matchedProduct={matchedProduct} />;
          })}
        </div>
      )}
    </div>
  );
}
