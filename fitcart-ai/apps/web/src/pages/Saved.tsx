import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthState';
import { supabase } from '../lib/supabase';
import ProductImage from '../components/ProductImage';

interface SizeMemoryRow {
  brand: string;
  size: string;
  note: string;
}

type LooksTab = 'saved' | 'outfits' | 'tried-on' | 'recently-viewed';

const TABS: { key: LooksTab; label: string }[] = [
  { key: 'saved', label: 'Saved' },
  { key: 'outfits', label: 'Outfits' },
  { key: 'tried-on', label: 'Tried on' },
  { key: 'recently-viewed', label: 'Recently viewed' },
];

function EmptyTabState({ message }: { message: string }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 28, textAlign: 'center', marginBottom: 36 }}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: 0 }}>{message}</p>
    </div>
  );
}

export default function Saved() {
  const navigate = useNavigate();
  const { products, savedProductIds, toggleSave } = useAppState();
  const { user } = useAuth();
  const savedProducts = savedProductIds.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const [activeTab, setActiveTab] = useState<LooksTab>('saved');
  // `null` = no real size-memory data (guest, signed-in user with no rows
  // yet, or Supabase not configured). Only ever set to a real array once
  // real rows come back from Supabase — never fabricated.
  const [sizeMemory, setSizeMemory] = useState<SizeMemoryRow[] | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setSizeMemory(null);
      return;
    }
    supabase
      .from('size_memory')
      .select('brand, size, note')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setSizeMemory(data && data.length > 0 ? data : null);
      });
  }, [user]);

  const handleSaveEmptyState = () => {
    if (!user) {
      navigate('/auth?redirect=/saved');
      return;
    }
    navigate('/setup');
  };

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>My looks</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 24px' }}>
        Everything you have tried on, saved, or put together.
      </p>

      <div role="tablist" aria-label="My looks" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--ink-soft)',
                border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
                fontSize: 12.5,
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'saved' && (
        <>
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
                  <div onClick={() => navigate(`/product/${p.id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
                    <ProductImage product={p} ratio="1/1" radius={0}>
                      <span
                        style={{
                          position: 'absolute', top: 8, left: 8, background: 'var(--accent)', color: '#fff',
                          borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                        }}
                      >
                        Saved
                      </span>
                    </ProductImage>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 8px' }}>Saved from {p.store}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => navigate('/setup', { state: { productId: p.id } })}
                        style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 11.5, fontWeight: 700, padding: '8px 10px', borderRadius: 7, cursor: 'pointer' }}
                      >
                        Try again
                      </button>
                      {p.productUrl ? (
                        <a
                          href={p.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1, textAlign: 'center', background: 'none', border: '1px solid var(--border)', color: 'var(--ink-soft)',
                            fontSize: 11.5, fontWeight: 600, padding: '8px 10px', borderRadius: 7, textDecoration: 'none',
                          }}
                        >
                          Buy
                        </a>
                      ) : (
                        <button
                          onClick={() => navigate(`/product/${p.id}`)}
                          style={{ flex: 1, background: 'none', border: '1px solid var(--border)', color: 'var(--ink-soft)', fontSize: 11.5, fontWeight: 600, padding: '8px 10px', borderRadius: 7, cursor: 'pointer' }}
                        >
                          Buy
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => toggleSave(p.id)}
                      style={{ marginTop: 6, width: '100%', background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 11, fontWeight: 600, padding: '4px 0', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'outfits' && <EmptyTabState message="No outfits saved yet." />}
      {activeTab === 'tried-on' && <EmptyTabState message="You haven't tried anything on yet." />}
      {activeTab === 'recently-viewed' && <EmptyTabState message="Nothing viewed recently." />}

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>Size memory</div>
      {sizeMemory && sizeMemory.length > 0 ? (
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
      ) : (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: 0 }}>
            No size history yet — save a few looks and we'll remember what fit.
          </p>
        </div>
      )}
    </main>
  );
}
