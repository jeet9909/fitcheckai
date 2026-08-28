import { useLocation, useNavigate } from 'react-router-dom';

const ITEMS: { path: string; label: string; shape: string }[] = [
  { path: '/setup', label: 'Try', shape: '5px 5px 0 0' },
  { path: '/discover', label: 'Discover', shape: '5px' },
  { path: '/saved', label: 'My Looks', shape: '50% 50% 50% 0' },
];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === '/') return null;

  return (
    <nav
      className="mobile-nav"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)',
        borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around',
        padding: '8px 4px 10px', zIndex: 60,
      }}
    >
      {ITEMS.map((m) => {
        const active = location.pathname === m.path;
        const color = active ? 'var(--ink)' : 'var(--ink-faint)';
        return (
          <button
            key={m.path}
            onClick={() => navigate(m.path)}
            style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color, padding: '4px 8px' }}
          >
            <span style={{ width: 18, height: 18, border: '1.5px solid currentColor', borderRadius: m.shape }} />
            {m.label}
          </button>
        );
      })}
    </nav>
  );
}
