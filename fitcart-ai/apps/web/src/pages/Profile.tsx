import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

export default function Profile() {
  const navigate = useNavigate();
  const { profileSetupDone, deleteBodyData } = useAppState();

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 28px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ink)', color: '#fff', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Aanya Kapoor</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>aanya@example.com</div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Fit profile</div>
        {profileSetupDone ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Profile complete · photo &amp; measurements on file</span>
            <button onClick={deleteBodyData} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 7 }}>Delete body data</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No fit profile yet</span>
            <button onClick={() => navigate('/setup')} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 7 }}>Set up</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <button onClick={() => navigate('/saved')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Saved &amp; wishlist</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>View saved items →</div>
        </button>
        <button onClick={() => navigate('/cart')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Orders</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>View cart &amp; orders →</div>
        </button>
        <button onClick={() => navigate('/tiers')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Subscription</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Manage your plan →</div>
        </button>
        <button onClick={() => navigate('/privacy')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Privacy &amp; consent</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Manage body data →</div>
        </button>
      </div>
    </main>
  );
}
