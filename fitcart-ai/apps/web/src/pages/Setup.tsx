import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

export default function Setup() {
  const navigate = useNavigate();
  const { consent, toggleConsent, markProfileSetupDone } = useAppState();

  const submitSetup = () => {
    markProfileSetupDone();
    navigate('/processing', { state: { afterRoute: '/tryon' } });
  };

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 28px 100px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>Create your personal fit profile</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 32px' }}>Used only to estimate fit. Delete this anytime from your profile.</p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>1. Upload a full-body photo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ aspectRatio: '3/4', border: '1.5px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-faint)' }}>
            <span style={{ fontSize: 22 }}>+</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Upload photo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: 'var(--ink-soft)', justifyContent: 'center' }}>
            {['Full body, head to feet', 'Good, even lighting', 'Front-facing, arms relaxed', 'Clear clothing silhouette'].map((t) => (
              <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ color: 'var(--accent-dark)' }}>✓</span>{t}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>2. A few measurements</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 5 }}>Height (cm)</div><input placeholder="175" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }} /></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 5 }}>Weight (kg) — optional</div><input placeholder="70" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }} /></div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 28, background: 'var(--surface-alt)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>3. Consent</div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 14px' }}>Your photos are protected and used only to estimate fit and generate a preview. Delete your body data anytime from your profile.</p>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={consent.photos} onChange={() => toggleConsent('photos')} style={{ marginTop: 2 }} />
          <span>I consent to FitCart analyzing my photo to estimate fit and generate a preview.</span>
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={consent.sharing} onChange={() => toggleConsent('sharing')} style={{ marginTop: 2 }} />
          <span>I'd like my (anonymized) fit feedback to help improve FitCart's AI for everyone.</span>
        </label>
      </div>
      <button onClick={submitSetup} style={{ width: '100%', background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, padding: 15, borderRadius: 9 }}>Create Fit Profile</button>
    </main>
  );
}
