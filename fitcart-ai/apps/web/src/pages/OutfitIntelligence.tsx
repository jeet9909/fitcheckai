import { useNavigate } from 'react-router-dom';
import { computeOutfitScore } from '../lib/outfitScore';
import { useAppState } from '../state/AppState';

export default function OutfitIntelligence() {
  const navigate = useNavigate();
  const { outfit } = useAppState();
  const outfitScore = computeOutfitScore(outfit);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 28px 100px' }}>
      <button onClick={() => navigate('/tryon')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18, padding: 0 }}>← Back to Try-On</button>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>Outfit Intelligence</h1>
      {outfitScore ? (
        <div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 6 }}>Overall Outfit Score</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{outfitScore.overall}<span style={{ fontSize: 15, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Breakdown</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}><span style={{ color: 'var(--ink-soft)' }}>Color harmony</span><span style={{ fontWeight: 700 }}>{outfitScore.colorHarmony}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}><span style={{ color: 'var(--ink-soft)' }}>Style consistency</span><span style={{ fontWeight: 700 }}>{outfitScore.styleMatch}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13.5 }}><span style={{ color: 'var(--ink-soft)' }}>Occasion suitability</span><span style={{ fontWeight: 700 }}>{outfitScore.occasionFit}</span></div>
          </div>
          <div style={{ background: 'var(--surface-alt)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>AI style explanation</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>{outfitScore.why}</p>
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>Add at least two items to your outfit to see an Outfit Score.</p>
          <button onClick={() => navigate('/outfit')} style={{ marginTop: 14, background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, padding: '11px 18px', borderRadius: 8 }}>Go to Outfit Studio</button>
        </div>
      )}
    </main>
  );
}
