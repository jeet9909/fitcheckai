import { useEffect, useState } from 'react';
import type { Product } from '../data/products';
import { fetchMatchGroup } from '../lib/api';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';

/**
 * Landing-page teaser for cross-store price comparison, built on top of the
 * same manually-curated match groups AlsoAvailableAt uses on ProductDetail
 * (fetchMatchGroup — see lib/api.ts). Curation is sparse today, so this
 * renders nothing at all — never a fabricated store count or price — when
 * the given product has fewer than two real store entries.
 */
export default function PriceCompareTeaser({ productId }: { productId: number }) {
  const { products } = useAppState();
  const [members, setMembers] = useState<Product[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMembers(null);
    fetchMatchGroup(productId).then((result) => {
      if (!cancelled) setMembers(result);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const product = products.find((p) => p.id === productId);

  if (!members || !product) return null;

  const allListings = [product, ...members];
  if (allListings.length < 2) return null;

  const sorted = [...allListings].sort((a, b) => a.price - b.price);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const savings = highest.price - lowest.price;

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 24, background: 'var(--surface)' }}>
      <h2 className="display" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
        The same {product.category || 'item'}, {allListings.length} prices
      </h2>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>{product.name}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((listing) => (
          <li
            key={listing.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              fontSize: 14, padding: '10px 14px', borderRadius: 10,
              background: listing.id === lowest.id ? 'var(--teal-soft)' : 'var(--surface-alt)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{listing.store}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{fmt(listing.price)}</span>
              {listing.id === lowest.id && (
                <span className="fc-chip" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>Lowest</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {savings > 0 && (
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', margin: '16px 0 0' }}>
          You save {fmt(savings)} by choosing {lowest.store} over {highest.store}.
        </p>
      )}
    </section>
  );
}
