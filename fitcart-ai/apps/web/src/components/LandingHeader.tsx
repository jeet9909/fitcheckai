import { useNavigate } from 'react-router-dom';

export default function LandingHeader() {
  const navigate = useNavigate();
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Fit<span style={{ color: 'var(--accent)' }}>Cart</span>
        </span>
        <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', background: 'var(--accent-soft)', color: 'var(--accent-dark)', padding: '3px 7px', borderRadius: 20 }}>
          AI
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <button onClick={() => navigate('/tiers')} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-soft)' }}>Pricing</button>
        <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-soft)' }}>Privacy</button>
        <button onClick={() => navigate('/discover')} style={{ border: '1px solid var(--ink)', background: 'var(--ink)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 8 }}>Start Styling</button>
      </div>
    </header>
  );
}
