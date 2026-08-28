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
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-soft)', cursor: 'pointer' }}>Privacy</button>
        <button onClick={() => navigate('/setup')} className="fc-btn-primary" style={{ width: 'auto', padding: '10px 20px', fontSize: 14 }}>See it on me</button>
      </div>
    </header>
  );
}
