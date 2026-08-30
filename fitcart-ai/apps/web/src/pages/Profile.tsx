import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthState';

export default function Profile() {
  const navigate = useNavigate();
  const { profileSetupDone, deleteBodyData } = useAppState();
  const { user, isRealAccount, signOut } = useAuth();

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 28px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ink)', color: '#fff', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isRealAccount ? user!.email!.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{isRealAccount ? user!.email : 'Not signed in'}</div>
            {isRealAccount && <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{user!.email}</div>}
          </div>
        </div>
        {isRealAccount ? (
          <button onClick={signOut} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 7 }}>Sign out</button>
        ) : (
          <button onClick={() => navigate('/auth?redirect=/profile')} className="fc-btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 12.5 }}>Sign in</button>
        )}
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
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>My Looks</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>View saved renders →</div>
        </button>
        <button onClick={() => navigate('/privacy')} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Privacy &amp; consent</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Manage body data →</div>
        </button>
      </div>
    </main>
  );
}
