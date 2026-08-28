import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

const NAV_ITEMS: { path: string; label: string }[] = [
  { path: '/discover', label: 'Discover' },
  { path: '/setup', label: 'Try' },
  { path: '/saved', label: 'My Looks' },
];

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useAppState();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: 64,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <button
          onClick={() => navigate('/discover')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', padding: 0 }}
        >
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Fit<span style={{ color: 'var(--accent)' }}>Cart</span>
          </span>
          <span
            className="mono"
            style={{ fontSize: 9, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-dark)', padding: '2px 6px', borderRadius: 20 }}
          >
            AI
          </span>
        </button>
        <nav className="desktop-only" style={{ gap: 2 }}>
          {NAV_ITEMS.map((n) => {
            const active = location.pathname === n.path;
            return (
              <button
                key={n.path}
                onClick={() => navigate(n.path)}
                style={{
                  background: active ? 'var(--surface-alt)' : 'transparent',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '8px 14px',
                  borderRadius: 8,
                  color: active ? 'var(--ink)' : 'var(--ink-soft)',
                }}
              >
                {n.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="desktop-only" style={{ alignItems: 'center', gap: 8, background: 'var(--surface-alt)', borderRadius: 8, padding: '8px 12px', width: 220 }}>
          <span style={{ width: 14, height: 14, border: '1.5px solid var(--ink-faint)', borderRadius: '50%', display: 'inline-block', position: 'relative', flex: 'none' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FitCart"
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: 'var(--ink)', width: '100%' }}
          />
        </div>
        <button
          onClick={() => navigate('/profile')}
          aria-label="Profile"
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ink)', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          A
        </button>
      </div>
    </header>
  );
}
