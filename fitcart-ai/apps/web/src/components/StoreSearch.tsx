import { useState } from 'react';
import { searchMarketplaces, type MarketplaceSearchResult, type ProviderStatus, type StoreListing } from '../lib/api';
import { isAllowedMarketplaceUrl } from '../lib/marketplaceUrls';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';

const PROVIDER_LABELS: Record<'amazon' | 'flipkart', string> = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
};

const PROVIDER_ORDER: Array<'amazon' | 'flipkart'> = ['amazon', 'flipkart'];

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
    case 'not_configured':
    default:
      return `${name}: not connected yet`;
  }
}

function ListingRow({ listing }: { listing: StoreListing }) {
  const isMock = listing.source === 'mock';
  // Mock listings deliberately point at example.com (see mockData.ts) and
  // are never expected to pass the real Amazon/Flipkart domain allowlist —
  // the backend's own `filterAllowedListings` skips them for the same
  // reason. Applying the real-domain allowlist to them here would make
  // every demo result look broken ("Link unavailable"). They're always
  // visually tagged "Demo" (below) so a demo link can never be confused
  // with a real one. Real listings still go through the allowlist exactly
  // as before.
  const allowed = isMock || isAllowedMarketplaceUrl(listing.store, listing.productUrl);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--surface)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-alt)', flexShrink: 0 }}>
        {listing.imageUrl && (
          <img src={listing.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.name}</span>
          {isMock && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--amber-text)', background: 'var(--amber-soft)', borderRadius: 5, padding: '1px 6px' }}>Demo</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{listing.brand} · {listing.store}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(listing.price)}</div>
        {allowed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
            {isMock && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--amber-text)', background: 'var(--amber-soft)', borderRadius: 5, padding: '1px 6px' }}>Demo</span>
            )}
            <a
              href={listing.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--accent-dark)', fontWeight: 600 }}
            >
              View
            </a>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }} title="Link unavailable">Link unavailable</span>
        )}
      </div>
    </div>
  );
}

export default function StoreSearch() {
  const { showToast, refreshProducts } = useAppState();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<MarketplaceSearchResult | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || searching) return;
    setSearching(true);
    try {
      const res = await searchMarketplaces(trimmed, 'all');
      setResult(res);
      if (res.results.length > 0) {
        await refreshProducts();
      }
    } catch {
      showToast('Could not reach store search — try again');
    } finally {
      setSearching(false);
    }
  };

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
          style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 8, opacity: searching || !query.trim() ? 0.6 : 1 }}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {result?.mock && (
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

      {result && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROVIDER_ORDER.map((key) => {
            const provider = result.providers[key];
            if (!provider) return null;
            const label = PROVIDER_LABELS[key];
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

      {result && result.results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.results.map((listing, i) => (
            <ListingRow key={`${listing.productUrl}-${i}`} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
