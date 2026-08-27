import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRODUCTS, SLOT_LABELS, SLOT_ORDER, type Slot } from '../data/products';
import { computeOutfitScore } from '../lib/outfitScore';
import { useAppState } from '../state/AppState';
import Placeholder from '../components/Placeholder';
import ProductImage from '../components/ProductImage';

const ANGLES: { key: string; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
];

export default function TryOnStudio() {
  const navigate = useNavigate();
  const { outfit, addToCart, showToast } = useAppState();
  const [angle, setAngle] = useState('front');
  const [fitSlot, setFitSlot] = useState<Slot>('top');

  const outfitScore = computeOutfitScore(outfit);

  const filledSlots = SLOT_ORDER.filter((slot) => outfit[slot]);
  const targetSlot = filledSlots.includes(fitSlot) ? fitSlot : filledSlots[0];
  const tryOnFitTarget = targetSlot ? { slot: targetSlot, label: SLOT_LABELS[targetSlot], product: PRODUCTS.find((p) => p.id === outfit[targetSlot])! } : null;

  const handleAddOutfitToCart = () => {
    const ids = SLOT_ORDER.map((slot) => outfit[slot]).filter((id): id is number => Boolean(id));
    if (ids.length === 0) {
      showToast('Add items to your outfit first');
      return;
    }
    ids.forEach((id) => addToCart(id));
    navigate('/cart');
  };

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>Try-On Studio</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 320px', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Selected outfit</div>
          {SLOT_ORDER.map((slot) => {
            const productId = outfit[slot];
            if (!productId) return null;
            const product = PRODUCTS.find((p) => p.id === productId)!;
            return (
              <div key={slot} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, display: 'flex', gap: 9, alignItems: 'center' }}>
                <ProductImage product={product} ratio="1/1" radius={6} style={{ width: 40, height: 40, flex: 'none' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{SLOT_LABELS[slot]}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <Placeholder ratio="3/4" radius={16} fontSize={12} padding={24} style={{ maxHeight: 640 }}>
            MULTI-ANGLE AI PREVIEW — {ANGLES.find((a) => a.key === angle)?.label}
            <div style={{ position: 'absolute', top: 16, left: 16, background: '#fff', borderRadius: 20, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', fontFamily: "'Sora',sans-serif" }}>AI Preview · generated from your profile</div>
          </Placeholder>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            {ANGLES.map((a) => {
              const active = angle === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setAngle(a.key)}
                  style={{ border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--ink)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-soft)', fontSize: 12.5, fontWeight: 600, padding: '9px 20px', borderRadius: 20 }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>AI Preview confidence</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>84%</div>
          </div>
          {tryOnFitTarget && (
            <button
              onClick={() => { setFitSlot(tryOnFitTarget.slot); navigate('/fit', { state: { productId: tryOnFitTarget.product.id } }); }}
              style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface)' }}
            >
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>Fit Score · {tryOnFitTarget.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-dark)' }}>{tryOnFitTarget.product.fitScore}<span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
              <div style={{ fontSize: 11.5, color: 'var(--accent-dark)', fontWeight: 600, marginTop: 6 }}>View details →</div>
            </button>
          )}
          {outfitScore && (
            <button onClick={() => navigate('/outfit-score')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>Outfit Score</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{outfitScore.overall}<span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
              <div style={{ fontSize: 11.5, color: 'var(--accent-dark)', fontWeight: 600, marginTop: 6 }}>View details →</div>
            </button>
          )}
          <button onClick={handleAddOutfitToCart} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 600, padding: 13, borderRadius: 9 }}>Add Outfit to Cart</button>
        </div>
      </div>
    </main>
  );
}
