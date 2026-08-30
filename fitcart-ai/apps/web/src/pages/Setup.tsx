import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';
import { isSupabaseConfigured } from '../lib/supabase';
import { uploadBodyProfile } from '../lib/bodyProfile';

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
  const routeState = location.state as {
    sourceLink?: string | null;
    productId?: number;
    parsedProduct?: { id?: number };
  } | null;
  const sourceLink = routeState?.sourceLink ?? null;
  const productId = routeState?.productId ?? routeState?.parsedProduct?.id ?? null;
  const { markProfileSetupDone, consent, showToast } = useAppState();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const submitSetup = async () => {
    markProfileSetupDone();

    if (!isSupabaseConfigured || !file) {
      navigate('/processing', { state: { afterRoute: '/result', sourceLink, productId } });
      return;
    }

    setSubmitting(true);
    try {
      const bodyProfile = await uploadBodyProfile(file, consent.sharing);
      setSubmitting(false);
      if (!bodyProfile) {
        showToast('Could not save your photo — try again');
        return;
      }
      navigate('/processing', { state: { productId, bodyProfileId: bodyProfile.id, sourceLink } });
    } catch {
      setSubmitting(false);
      showToast('Could not upload your photo — try again');
    }
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

      <button onClick={submitSetup} disabled={!preview || submitting} className="fc-btn-primary" style={{ opacity: preview && !submitting ? 1 : 0.45 }}>
        {submitting ? 'Uploading…' : 'See it on me'}
      </button>
    </main>
  );
}
