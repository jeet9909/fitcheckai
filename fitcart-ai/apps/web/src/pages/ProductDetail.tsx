import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { discountLabel, fmt, confidenceBand, toneColor } from '../lib/format';
import { fetchMatchGroup } from '../lib/api';
import { useAppState } from '../state/AppState';
import ProductImage from '../components/ProductImage';
import AlsoAvailableAt from '../components/AlsoAvailableAt';
import SimilarProducts from '../components/SimilarProducts';
import type { Product } from '../data/products';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, savedProductIds, toggleSave } = useAppState();
  const [matchGroupMembers, setMatchGroupMembers] = useState<Product[]>([]);

  const product = products.find((p) => p.id === Number(id));

  // Co-located with this page's only other data need (the catalog itself,
  // already loaded into AppState) — this is a small, product-specific
  // lookup so it gets its own effect keyed on the product id, rather than
  // being folded into AppState's app-wide catalog load.
  useEffect(() => {
    if (!product) {
      // /product/:id reuses the same mounted component across navigations
      // between different ids (see App.tsx's single Route), so this guards
      // against a stale previous product's cross-store matches lingering
      // on screen while the catalog is (re)loading for a new id.
      setMatchGroupMembers([]);
      return;
    }
    let cancelled = false;
    fetchMatchGroup(product.id).then((members) => {
      if (!cancelled) setMatchGroupMembers(members);
    });
    return () => {
      cancelled = true;
    };
  }, [product]);

  if (!product) {
    return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 28px 80px' }} />;
  }
  const isSaved = savedProductIds.includes(product.id);
  const band = confidenceBand(product.confidence);
  const hasBrand = Boolean(product.brand) && product.brand !== 'Unknown';
  const hasColor = Boolean(product.color);
  const hasMaterial = Boolean(product.material);
  // Real/scraped listings only ever carry one photo and no fit-breakdown —
  // see products/amazonBrowseNodes.ts and schema.sql's column defaults
  // (material: '', confidence: 75, breakdown: []) for why. Rendering a fake
  // multi-photo gallery or a "confidence" score with nothing behind it would
  // misrepresent what this catalog actually knows about the item.
  const hasRealFitData = product.breakdown.length > 0;

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 28px 80px' }}>
      <button onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18, padding: 0 }}>← Back to Discover</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
        <div>
          <ProductImage product={product} ratio="3/4" radius={14} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>
            {product.store}
            {hasBrand ? ` · ${product.brand}` : ''}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 12px' }}>{product.name}</h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{fmt(product.price)}</span>
            <span style={{ fontSize: 14, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>{fmt(product.mrp)}</span>
            <span style={{ fontSize: 13, color: 'var(--accent-dark)', fontWeight: 600 }}>{discountLabel(product.price, product.mrp)}</span>
          </div>
          {(hasColor || hasMaterial) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 13 }}>
              {hasColor && <div><div style={{ color: 'var(--ink-faint)', marginBottom: 3 }}>Color</div><div style={{ fontWeight: 600 }}>{product.color}</div></div>}
              {hasMaterial && <div><div style={{ color: 'var(--ink-faint)', marginBottom: 3 }}>Material</div><div style={{ fontWeight: 600 }}>{product.material}</div></div>}
            </div>
          )}
          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)', marginBottom: 20, textDecoration: 'none' }}
            >
              View full listing on {product.store} ↗
            </a>
          )}
          {/* No real per-product size data exists yet (fetch-product's
              parsers all hardcode sizeChart: null — see
              supabase/functions/fetch-product/parsers/*.ts), so there's
              nothing honest to show here. A clickable S/M/L/XL row with no
              data behind it would imply real size availability that doesn't
              exist; omitting it entirely (rather than a fake picker) matches
              this page's hasRealFitData pattern below. */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            <button onClick={() => navigate('/setup', { state: { productId: product.id } })} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 9 }}>See it on me</button>
            <button onClick={() => toggleSave(product.id)} style={{ border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontWeight: 600, padding: '14px 18px', borderRadius: 9, color: isSaved ? 'var(--accent-dark)' : 'var(--ink-faint)' }}>{isSaved ? '♥ Saved' : '♡ Save'}</button>
          </div>
          {hasRealFitData ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, background: 'var(--surface-alt)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>How this may fit you</h3>
                <span style={{ background: band.bg, color: band.color, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12 }}>Confidence {product.confidence}%</span>
              </div>
              {product.breakdown.map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink-soft)' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: toneColor(row.tone) }}>{row.value}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '12px 0 0', lineHeight: 1.5 }}>AI estimate based on your fit profile. Not a guaranteed measurement.</p>
            </div>
          ) : (
            // No per-product fit breakdown exists for this item yet (true for
            // every real scraped/populated listing today — schema.sql's
            // `breakdown` column defaults to `[]`) — showing a "Confidence
            // 75%" badge with nothing behind it would be a fabricated claim,
            // not a real assessment, so this states that honestly instead.
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, background: 'var(--surface-alt)', fontSize: 13, color: 'var(--ink-faint)' }}>
              A personalized fit estimate isn't available for this item yet. Try "See it on me" for a live fit check against your profile.
            </div>
          )}
        </div>
      </div>
      <AlsoAvailableAt members={matchGroupMembers} />
      <SimilarProducts product={product} allProducts={products} />
    </main>
  );
}
