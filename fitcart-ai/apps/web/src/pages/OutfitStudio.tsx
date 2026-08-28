import { useState } from 'react';
import { SLOT_LABELS, SLOT_ORDER, type Slot } from '../data/products';
import { fmt } from '../lib/format';
import { computeOutfitScore } from '../lib/outfitScore';
import { useAppState } from '../state/AppState';
import { useStartTryOn } from '../lib/useStartTryOn';
import ProductImage from '../components/ProductImage';

export default function OutfitStudio() {
  const { products, outfit, removeFromSlot, selectForSlot } = useAppState();
  const [pickingSlot, setPickingSlot] = useState<Slot | null>(null);
  const startTryOnFlow = useStartTryOn();

  const outfitScore = computeOutfitScore(outfit, products);
  const pickerProducts = pickingSlot ? products.filter((p) => p.slot === pickingSlot) : [];

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Outfit Studio</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 28px' }}>Build a complete outfit and see how it works together.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {SLOT_ORDER.map((slotKey) => {
            const productId = outfit[slotKey];
            const product = productId ? products.find((p) => p.id === productId) : null;
            const label = SLOT_LABELS[slotKey];
            return (
              <div key={slotKey} style={{ border: '1px dashed var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
                {product ? (
                  <div>
                    <ProductImage product={product} ratio="1/1" radius={0}>
                      <button onClick={() => removeFromSlot(slotKey)} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#fff', color: 'var(--ink-soft)', fontSize: 12 }}>✕</button>
                    </ProductImage>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, margin: '2px 0 6px' }}>{product.name}</div>
                      <button onClick={() => setPickingSlot(slotKey)} style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 600, padding: 0 }}>Replace</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setPickingSlot(slotKey)}
                    style={{ width: '100%', aspectRatio: '3/4', background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-faint)' }}
                  >
                    <span style={{ fontSize: 22 }}>+</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Add {label}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 22, background: 'var(--surface-alt)', position: 'sticky', top: 84 }}>
          {outfitScore ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4 }}>Outfit Score</div>
              <div style={{ fontSize: 38, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>{outfitScore.overall}<span style={{ fontSize: 16, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-soft)' }}>Color harmony</span><span style={{ fontWeight: 600 }}>{outfitScore.colorHarmony}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-soft)' }}>Style match</span><span style={{ fontWeight: 600 }}>{outfitScore.styleMatch}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-soft)' }}>Occasion fit</span><span style={{ fontWeight: 600 }}>{outfitScore.occasionFit}</span></div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Why this works</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)', margin: '0 0 20px' }}>{outfitScore.why}</p>
            </div>
          ) : (
            <div style={{ padding: '12px 0 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Add at least 2 items</div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: 0 }}>FitCart scores color harmony, style match and occasion fit once your outfit has a top and one more piece.</p>
            </div>
          )}
          <button onClick={() => startTryOnFlow()} style={{ width: '100%', background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 9 }}>Try On This Outfit</button>
        </div>
      </div>

      {pickingSlot && (
        <div
          onClick={() => setPickingSlot(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, maxWidth: 640, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Choose an item</h3>
              <button onClick={() => setPickingSlot(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--ink-faint)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {pickerProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { selectForSlot(pickingSlot, p.id); setPickingSlot(null); }}
                  style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', textAlign: 'left', padding: 0 }}
                >
                  <ProductImage product={p} ratio="1/1" radius={0} />
                  <div style={{ padding: 9 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>{fmt(p.price)} · {p.store}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
