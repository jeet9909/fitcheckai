import { useAppState } from '../state/AppState';

export default function Privacy() {
  const { consent, toggleConsent, deleteBodyData } = useAppState();

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Privacy &amp; Consent</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px' }}>Body data is sensitive. Here's exactly how FitCart handles it.</p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Why we ask for a photo</div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>To estimate fit and generate a multi-angle preview. It is never used for anything else.</p>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>How it's stored</div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>Encrypted, and retained only while your fit profile is active. You control deletion at any time.</p>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Consent settings</div>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
          <span>Analyze my photo for fit &amp; preview</span>
          <input type="checkbox" checked={consent.photos} onChange={() => toggleConsent('photos')} />
        </label>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 13, cursor: 'pointer' }}>
          <span>Use anonymized feedback to improve AI</span>
          <input type="checkbox" checked={consent.sharing} onChange={() => toggleConsent('sharing')} />
        </label>
      </div>
      <button onClick={deleteBodyData} style={{ width: '100%', background: 'none', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13.5, fontWeight: 600, padding: 13, borderRadius: 9 }}>Delete all body data</button>
    </main>
  );
}
