import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthState';
import { supabase } from '../lib/supabase';
import ProductImage from '../components/ProductImage';

const FALLBACK_SIZE_MEMORY = [
  { brand: "Levi's", size: '34 / M', note: 'True to size' },
  { brand: 'H&M', size: 'L', note: 'Runs small' },
  { brand: 'Zara', size: 'M', note: 'True to size' },
];

export default function Saved() {
  const navigate = useNavigate();
  const { products, savedProductIds, toggleSave } = useAppState();
  const { user, isRealAccount } = useAuth();
  const savedProducts = savedProductIds.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const [sizeMemory, setSizeMemory] = useState(FALLBACK_SIZE_MEMORY);

  useEffect(() => {
    if (!supabase || !isRealAccount || !user) return;
    supabase
      .from('size_memory')
      .select('brand, size, note')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) setSizeMemory(data);
      });
  }, [user, isRealAccount]);

  const handleSaveEmptyState = () => {
    if (!isRealAccount) {
      navigate('/auth?redirect=/saved');
      return;
    }
    navigate('/setup');
  };

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>My Looks</h1>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Saved renders</div>
      {savedProducts.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 28, textAlign: 'center', marginBottom: 36 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 14px' }}>Nothing saved yet. Try a garment on and save the render.</p>
          <button
            onClick={handleSaveEmptyState}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 8 }}
          >
            See it on me
          </button>
        </div>
      ) : (
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
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Size memory</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {sizeMemory.map((row, i) => (
          <div
            key={row.brand}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
              borderBottom: i < sizeMemory.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{row.brand}</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{row.size}</span>
            <span style={{ fontSize: 12, color: row.note === 'Runs small' ? 'var(--amber-text)' : 'var(--teal)' }}>{row.note}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
