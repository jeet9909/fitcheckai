import { useLocation, useNavigate } from 'react-router-dom';
import { PRODUCTS, SLOT_ORDER } from '../data/products';
import { confidenceBand, recommendation, toneBg, toneColor } from '../lib/format';
import { useAppState } from '../state/AppState';

export default function FitIntelligence() {
  const navigate = useNavigate();
  const location = useLocation();
  const { outfit } = useAppState();

  const stateProductId = (location.state as { productId?: number } | null)?.productId;
  const firstOutfitProductId = SLOT_ORDER.map((s) => outfit[s]).find((id) => id) ?? null;
  const product = PRODUCTS.find((p) => p.id === (stateProductId ?? firstOutfitProductId)) ?? PRODUCTS[0];
  const band = confidenceBand(product.confidence);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 28px 100px' }}>
      <button onClick={() => navigate('/tryon')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18, padding: 0 }}>← Back to Try-On</button>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Fit Intelligence</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 24px' }}>{product.name} · {product.brand}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 6 }}>Overall Fit Score</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent-dark)' }}>{product.fitScore}<span style={{ fontSize: 15, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 6 }}>Confidence</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{product.confidence}%</div>
          <div style={{ fontSize: 11.5, color: band.color, fontWeight: 600, marginTop: 4 }}>{band.label}</div>
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Breakdown by region</div>
        {product.breakdown.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
            <span style={{ color: 'var(--ink-soft)' }}>{row.label}</span>
            <span style={{ fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: toneBg(row.tone), color: toneColor(row.tone) }}>{row.value}</span>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--surface-alt)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Fit recommendation</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 8px' }}>{recommendation(product.fitScore)}</p>
        <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', margin: 0 }}>AI estimate based on your profile. Not a guaranteed measurement.</p>
      </div>
    </main>
  );
}
