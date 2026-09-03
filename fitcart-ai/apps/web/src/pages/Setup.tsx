import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

/**
 * ONE PHOTO. This replaces the old 3-step form (photo + height/weight +
 * two consent checkboxes) that the audit flagged as the single biggest
 * leak: the largest ask in the whole product, arriving before any value
 * had been shown. Height/weight now live behind an optional "improve
 * accuracy" prompt AFTER the first render, not here.
 */
export default function Setup() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupState = location.state as { sourceLink?: string | null; productId?: number | null } | null;
  const sourceLink = setupState?.sourceLink ?? null;
  const productId = setupState?.productId ?? null;
  const { markProfileSetupDone } = useAppState();
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submitSetup = () => {
    markProfileSetupDone();
    navigate('/processing', { state: { afterRoute: '/result', sourceLink, productId } });
  };

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '32px 24px 100px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12.5, padding: 0, marginBottom: 18, cursor: 'pointer' }}>
        ← Back
      </button>
      <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>One full-body photo</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
        Stand straight, arms relaxed, head to feet.
      </p>

      <input ref={fileInput} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />

      <div
        onClick={() => fileInput.current?.click()}
        style={{
          aspectRatio: '3/5', borderRadius: 16, border: preview ? '1px solid var(--border)' : '2px dashed var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: preview ? `center/cover no-repeat url(${preview})` : 'var(--surface-alt)',
          cursor: 'pointer', marginBottom: 18, position: 'relative', overflow: 'hidden',
        }}
      >
        {!preview && (
          <>
            <span style={{ fontSize: 30, color: 'var(--ink-faint)' }}>+</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)', marginTop: 6 }}>Tap to take or upload a photo</span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => fileInput.current?.click()} className="fc-btn-secondary" style={{ flex: 1 }}>
          {preview ? 'Retake' : 'Take photo'}
        </button>
      </div>

      <div style={{ border: '1px solid var(--teal)', background: 'var(--teal-soft)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--teal)', lineHeight: 1.55, margin: 0 }}>
          Used only to render this look. Auto-deleted in 24 hours unless you save it. Never shown to anyone else.{' '}
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
            Details
          </button>
        </p>
      </div>

      <button onClick={submitSetup} disabled={!preview} className="fc-btn-primary" style={{ opacity: preview ? 1 : 0.45 }}>
        See it on me
      </button>
    </main>
  );
}
