import { useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import ProductImage from '../components/ProductImage';

export default function Saved() {
  const navigate = useNavigate();
  const { products, savedProductIds, toggleSave } = useAppState();
  const savedProducts = savedProductIds.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>Saved</h1>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Saved products</div>
      {savedProducts.length === 0 && <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 32px' }}>Nothing saved yet.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 36 }}>
        {savedProducts.map((p) => (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
            <div onClick={() => navigate(`/product/${p.id}`)} style={{ cursor: 'pointer' }}>
              <ProductImage product={p} ratio="1/1" radius={0} />
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 8px' }}>{fmt(p.price)} · {p.store}</div>
              <button onClick={() => toggleSave(p.id)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink-soft)', fontSize: 11.5, fontWeight: 600, padding: '7px 12px', borderRadius: 7 }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Recent try-ons</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 36 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Oxford Shirt + Sneakers</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Outfit Score 87 · 2 days ago</div>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Recent comparisons</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
        <button onClick={() => navigate('/compare')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Sneakers vs. Trainers</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>3 days ago →</div>
        </button>
      </div>
    </main>
  );
}
