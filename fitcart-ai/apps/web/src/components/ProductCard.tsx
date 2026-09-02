import { useNavigate } from 'react-router-dom';
import type { Product } from '../data/products';
import { discountLabel, fitBg, fitColor, fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import ProductImage from './ProductImage';

export default function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { savedProductIds, toggleSave } = useAppState();

  const isSaved = savedProductIds.includes(product.id);
  const isDemo = product.source?.endsWith('-mock') ?? false;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      <div onClick={() => navigate(`/product/${product.id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
        <ProductImage product={product} ratio="3/4" radius={0}>
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
            <span style={{ background: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 600, color: 'var(--ink-soft)', fontFamily: "'Sora',sans-serif" }}>{product.store}</span>
            {isDemo && (
              <span style={{ background: 'var(--amber-soft)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: 'var(--amber-text)', fontFamily: "'Sora',sans-serif" }}>Demo</span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSave(product.id); }}
            style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#fff', fontSize: 13, color: isSaved ? 'var(--accent-dark)' : 'var(--ink-faint)' }}
          >
            {isSaved ? '♥' : '♡'}
          </button>
        </ProductImage>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{product.brand}</div>
        <div onClick={() => navigate(`/product/${product.id}`)} style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{product.name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{fmt(product.price)}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>{fmt(product.mrp)}</span>
          <span style={{ fontSize: 11, color: 'var(--accent-dark)', fontWeight: 600 }}>{discountLabel(product.price, product.mrp)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ background: fitBg(product.fitScore), color: fitColor(product.fitScore), fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>Fit {product.fitScore}</span>
          <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>AI recommended</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={() => navigate('/setup', { state: { productId: product.id } })} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, padding: 8, borderRadius: 7 }}>See it on me</button>
        </div>
      </div>
    </div>
  );
}
