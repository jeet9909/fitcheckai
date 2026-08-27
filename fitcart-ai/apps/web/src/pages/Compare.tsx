import { useNavigate } from 'react-router-dom';
import { fitColor, fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import ProductImage from '../components/ProductImage';

export default function Compare() {
  const navigate = useNavigate();
  const { products, compareIds, toggleCompare, addToCart } = useAppState();
  const compareProducts = compareIds.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Compare</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 24px' }}>See why FitCart beats shopping directly on one store.</p>
      {compareProducts.length === 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 14px' }}>Nothing to compare yet. Add items from Discover.</p>
          <button onClick={() => navigate('/discover')} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, padding: '11px 18px', borderRadius: 8 }}>Go to Discover</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {compareProducts.map((p) => (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
            <ProductImage product={p} ratio="1/1" radius={0}>
              <button onClick={() => toggleCompare(p.id)} style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#fff', color: 'var(--ink-soft)', fontSize: 12 }}>✕</button>
            </ProductImage>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>{p.brand} · {p.store}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{p.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 12.5 }}><span style={{ color: 'var(--ink-faint)' }}>Price</span><span style={{ fontWeight: 600 }}>{fmt(p.price)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 12.5 }}><span style={{ color: 'var(--ink-faint)' }}>Fit Score</span><span style={{ fontWeight: 600, color: fitColor(p.fitScore) }}>{p.fitScore}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 12.5 }}><span style={{ color: 'var(--ink-faint)' }}>Confidence</span><span style={{ fontWeight: 600 }}>{p.confidence}%</span></div>
              <button onClick={() => addToCart(p.id)} style={{ width: '100%', marginTop: 12, background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 600, padding: 10, borderRadius: 8 }}>Add to Cart</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
