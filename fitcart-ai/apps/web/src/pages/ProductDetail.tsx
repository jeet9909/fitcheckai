import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { discountLabel, fmt, confidenceBand, toneColor } from '../lib/format';
import { useAppState } from '../state/AppState';
import ProductImage from '../components/ProductImage';
import { productImageUrl } from '../lib/productImage';

const SIZES = ['S', 'M', 'L', 'XL'];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, savedProductIds, toggleSave } = useAppState();
  const [selectedSize, setSelectedSize] = useState('M');

  const product = products.find((p) => p.id === Number(id));
  if (!product) {
    return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 28px 80px' }} />;
  }
  const isSaved = savedProductIds.includes(product.id);
  const band = confidenceBand(product.confidence);

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 28px 80px' }}>
      <button onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18, padding: 0 }}>← Back to Discover</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
        <div>
          <ProductImage product={product} ratio="3/4" radius={14} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-alt)', border: i === 0 ? '2px solid var(--ink)' : '1px solid var(--border)' }}>
                <img src={product.imageUrl || productImageUrl(product, 128, 128)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>{product.store} · {product.brand}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 12px' }}>{product.name}</h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{fmt(product.price)}</span>
            <span style={{ fontSize: 14, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>{fmt(product.mrp)}</span>
            <span style={{ fontSize: 13, color: 'var(--accent-dark)', fontWeight: 600 }}>{discountLabel(product.price, product.mrp)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 13 }}>
            <div><div style={{ color: 'var(--ink-faint)', marginBottom: 3 }}>Color</div><div style={{ fontWeight: 600 }}>{product.color}</div></div>
            <div><div style={{ color: 'var(--ink-faint)', marginBottom: 3 }}>Material</div><div style={{ fontWeight: 600 }}>{product.material}</div></div>
          </div>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 8 }}>Size</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SIZES.map((sz) => (
                <span
                  key={sz}
                  onClick={() => setSelectedSize(sz)}
                  style={{ cursor: 'pointer', border: sz === selectedSize ? '2px solid var(--ink)' : '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600 }}
                >
                  {sz}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            <button onClick={() => navigate('/setup', { state: { productId: product.id } })} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 9 }}>See it on me</button>
            <button onClick={() => toggleSave(product.id)} style={{ border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontWeight: 600, padding: '14px 18px', borderRadius: 9, color: isSaved ? 'var(--accent-dark)' : 'var(--ink-faint)' }}>{isSaved ? '♥ Saved' : '♡ Save'}</button>
          </div>
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
        </div>
      </div>
    </main>
  );
}
