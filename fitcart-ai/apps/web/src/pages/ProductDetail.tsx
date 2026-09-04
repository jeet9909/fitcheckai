import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { discountLabel, fmt, confidenceBand, toneColor } from '../lib/format';
import { fetchMatchGroup } from '../lib/api';
import { useAppState } from '../state/AppState';
import ProductImage from '../components/ProductImage';
import Placeholder from '../components/Placeholder';
import AlsoAvailableAt from '../components/AlsoAvailableAt';
import SimilarProducts from '../components/SimilarProducts';
import type { Product } from '../data/products';

// Thumbnails are small, fixed-size (64x64) tiles clipped by their parent
// button's overflow:hidden — unlike the large main image, they don't need
// ProductImage's aspect-ratio/absolute-positioning machinery. Each thumbnail
// still needs its own onError → placeholder fallback (a broken thumbnail URL
// shouldn't sit there as the browser's native broken-image icon forever), so
// this reuses the same Placeholder component ProductImage falls back to,
// scoped to just the one broken tile rather than the whole strip.
function GalleryThumbnail({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Placeholder ratio="1/1" radius={0} fontSize={9} padding={0} style={{ width: '100%', height: '100%' }} />;
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

// Curator-authored `sizeChart` is loose, unvalidated JSON (different
// categories use different keys — chest/waist for tops, waist/inseam for
// bottoms) rather than a fixed schema, so this must degrade to "nothing to
// show" for any shape that isn't a plain key/value object instead of
// throwing and taking the whole page down with it.
function sizeChartEntries(sizeChart: unknown): [string, unknown][] {
  try {
    if (typeof sizeChart !== 'object' || sizeChart === null || Array.isArray(sizeChart)) return [];
    return Object.entries(sizeChart as Record<string, unknown>);
  } catch {
    return [];
  }
}

function formatSizeChartValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, savedProductIds, toggleSave } = useAppState();
  const [matchGroupMembers, setMatchGroupMembers] = useState<Product[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  // Same across-navigations reuse concern as matchGroupMembers above — reset
  // the selected gallery thumbnail so product B doesn't open on whichever
  // thumbnail index the user last clicked while viewing product A.
  useEffect(() => {
    setActiveImageIndex(0);
  }, [product]);

  if (!product) {
    return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 28px 80px' }} />;
  }
  const isSaved = savedProductIds.includes(product.id);
  const band = confidenceBand(product.confidence);
  const hasBrand = Boolean(product.brand) && product.brand !== 'Unknown';
  const hasColor = Boolean(product.color);
  const hasMaterial = Boolean(product.material);
  const hasDescription = Boolean(product.description);
  // Real/scraped listings only ever carry no fit-breakdown — see
  // products/amazonBrowseNodes.ts and schema.sql's column defaults
  // (confidence: 75, breakdown: []) for why. Showing a "confidence" score
  // with nothing behind it would misrepresent what this catalog actually
  // knows about the item.
  const hasRealFitData = product.breakdown.length > 0;
  // A real gallery only exists once a curator has populated `image_urls`
  // (schema default '{}', so this is empty for the overwhelming majority of
  // products today) — the single-photo `imageUrl` is always the first
  // thumbnail so the strip reflects the actual displayed main image.
  const galleryImages = product.imageUrls.length > 0
    ? [product.imageUrl, ...product.imageUrls].filter((url): url is string => Boolean(url))
    : [];
  const hasGallery = galleryImages.length > 0;
  const activeImage = hasGallery ? galleryImages[Math.min(activeImageIndex, galleryImages.length - 1)] : undefined;
  const sizeChartRows = sizeChartEntries(product.sizeChart);

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 28px 80px' }}>
      <button onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18, padding: 0 }}>← Back to Discover</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
        <div>
          {/* Keyed on the currently displayed image so ProductImage's own
              onError fallback state resets when the user switches thumbnails
              (rather than getting stuck showing the placeholder for every
              image after just one broken thumbnail). */}
          <ProductImage product={product} ratio="3/4" radius={14} src={activeImage} key={`${product.id}-${activeImage ?? ''}`} />
          {hasGallery && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {galleryImages.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`Show image ${index + 1} of ${galleryImages.length}`}
                  aria-pressed={index === activeImageIndex}
                  style={{
                    width: 64,
                    height: 64,
                    padding: 0,
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'none',
                    border: index === activeImageIndex ? '2px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <GalleryThumbnail url={url} />
                </button>
              ))}
            </div>
          )}
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
          {/* Curator-authored, defaults to '' for the vast majority of
              products — omitted silently (not a "no description available"
              placeholder) to match this page's established honest-empty-state
              convention. */}
          {hasDescription && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-faint)', margin: '0 0 6px' }}>Description</h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0, whiteSpace: 'pre-line' }}>{product.description}</p>
            </div>
          )}
          {/* Curator-authored, loose/uncontrolled JSON — see
              sizeChartEntries() above for why this degrades to nothing rather
              than throwing on a malformed value. Most products have no
              sizeChart yet, so this renders nothing for the common case. */}
          {sizeChartRows.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-faint)', margin: '0 0 6px' }}>Size chart</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                {sizeChartRows.map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <span style={{ color: 'var(--ink-faint)' }}>{key}</span>
                    <span style={{ fontWeight: 600 }}>{formatSizeChartValue(value)}</span>
                  </div>
                ))}
              </div>
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
          {/* No real per-product *selectable size* data exists (fetch-product's
              parsers all hardcode sizeChart: null, and there's no per-size
              stock/availability signal anywhere in this catalog — see
              supabase/functions/fetch-product/parsers/*.ts) — only a
              reference chart (rendered above, when curated) for products
              that have one. A clickable S/M/L/XL picker would imply real
              size availability that doesn't exist; omitting it entirely
              (rather than a fake picker) matches this page's hasRealFitData
              pattern below. */}
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
