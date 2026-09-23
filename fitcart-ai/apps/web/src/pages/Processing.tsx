import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createTryOn, saveLatestTryOn } from '../lib/fitcartApi';
import { clearTryOnDraft, getTryOnDraft } from '../lib/tryOnDraft';

const STEP_LABELS = [
  'Validating your photo',
  'Preparing the product reference',
  'Generating the virtual try-on with Gemini',
  'Saving your private gallery result',
];

export default function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { afterRoute?: string; sourceLink?: string | null; productId?: number | null } | null;
  const afterRoute = state?.afterRoute ?? '/result';
  const started = useRef(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = getTryOnDraft();
    if (!draft) {
      setError('Your selected photos were lost. Please upload them again.');
      return;
    }

    const progressTimer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
    }, 9000);

    createTryOn(draft)
      .then((item) => {
        window.clearInterval(progressTimer);
        setStep(STEP_LABELS.length);
        saveLatestTryOn(item);
        clearTryOnDraft();
        navigate(afterRoute, {
          replace: true,
          state: { sourceLink: state?.sourceLink ?? null, productId: state?.productId ?? null, tryOn: item },
        });
      })
      .catch((reason: unknown) => {
        window.clearInterval(progressTimer);
        setError(reason instanceof Error ? reason.message : 'Try-on generation failed. Please try again.');
      });

    return () => window.clearInterval(progressTimer);
  }, [afterRoute, attempt, navigate, state?.productId, state?.sourceLink]);

  const retry = () => {
    started.current = false;
    setError(null);
    setStep(0);
    setAttempt((value) => value + 1);
  };

  const progress = error ? 0 : step >= STEP_LABELS.length ? 100 : Math.max(8, Math.round(((step + 1) / STEP_LABELS.length) * 92));

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '64px 24px 100px' }}>
      <div style={{ aspectRatio: '3/4', borderRadius: 16, background: 'var(--surface-alt)', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div className="placeholder-swatch" style={{ position: 'absolute', inset: 0, fontSize: 11 }}>
          {error ? 'generation paused' : 'creating your real try-on…'}
        </div>
      </div>

      {error ? (
        <div role="alert" style={{ border: '1px solid var(--red)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <strong style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>We could not create this try-on</strong>
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{error}</span>
        </div>
      ) : (
        <>
          <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-alt)', marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 22px' }}>{progress}% · Gemini generation can take up to two minutes</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEP_LABELS.map((label, index) => index <= step && (
              <div key={label} style={{ display: 'flex', gap: 10, fontSize: 13, color: index < step ? 'var(--ink)' : 'var(--ink-soft)' }}>
                <span style={{ color: index < step ? 'var(--teal)' : 'var(--amber)', fontWeight: 700 }}>{index < step ? '✓' : '›'}</span>
                {label}
              </div>
            ))}
          </div>
        </>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/setup', { replace: true, state: { sourceLink: state?.sourceLink ?? null, productId: state?.productId ?? null } })} className="fc-btn-secondary" style={{ flex: 1 }}>Change images</button>
          <button onClick={retry} className="fc-btn-primary" style={{ flex: 1 }}>Try again</button>
        </div>
      )}
    </main>
  );
}
