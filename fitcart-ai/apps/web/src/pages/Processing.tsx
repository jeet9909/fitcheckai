import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startRender, QuotaExceededError } from '../lib/tryon';
import type { ProcessingResult } from '../lib/tryon';

const STEP_LABELS = [
  'Reading the garment…',
  'This brand runs small vs standard sizing',
  'Matching to your shoulders and chest…',
  'Checking against your saved size history…',
  'Finalizing your render…',
];

interface ProcessingState {
  afterRoute?: string;
  sourceLink?: string | null;
  productId?: number | null;
  bodyProfileId?: number;
}

/**
 * "The wait is content." A bare spinner makes 20s feel like 60s — typing
 * out real garment facts makes the wait feel like work being done for the
 * user, and it pre-sells the verdict that's coming on the Result screen.
 *
 * The step animation always runs (it's true regardless of backend state);
 * `bodyProfileId` being present is what determines whether a *real*
 * create-render call backs it. Without one (Supabase not configured, e.g.
 * local dev without credentials) this falls back to the original fixed-
 * timer navigation so the flow still demoes end to end.
 */
export default function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ProcessingState | null;
  const afterRoute = state?.afterRoute ?? '/result';
  const [step, setStep] = useState(0);
  const progress = Math.min(100, Math.round((step / STEP_LABELS.length) * 100));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((prev) => Math.min(prev + 1, STEP_LABELS.length));
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!state?.bodyProfileId) {
        // No real backend to call — keep the original fixed-timer demo path.
        window.setTimeout(() => {
          if (!cancelled) navigate(afterRoute, { replace: true, state: { sourceLink: state?.sourceLink ?? null } });
        }, STEP_LABELS.length * 900 + 500);
        return;
      }

      let result: ProcessingResult;
      try {
        result = { kind: 'done', render: await startRender(state.bodyProfileId, state.productId ?? null) };
      } catch (err) {
        result = err instanceof QuotaExceededError
          ? { kind: 'quota_exceeded' }
          : { kind: 'error', message: err instanceof Error ? err.message : 'Render failed' };
      }
      if (cancelled) return;
      navigate(afterRoute, { replace: true, state: { result } });
    }

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '64px 24px 100px' }}>
      <div style={{ aspectRatio: '3/4', borderRadius: 16, background: 'var(--surface-alt)', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div className="placeholder-swatch" style={{ position: 'absolute', inset: 0, fontSize: 11 }}>rendering your photo…</div>
      </div>

      <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-alt)', marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 6, transition: 'width 0.4s ease' }} />
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 22px' }}>
        {progress}% — about {Math.max(1, STEP_LABELS.length - step) * 1}s left
      </p>

      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 10 }}>
        Reading the garment
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
        {STEP_LABELS.map((label, i) => {
          const done = step > i;
          const active = step === i;
          if (!done && !active) return null;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: done ? 'var(--ink)' : 'var(--ink-soft)' }}>
              <span style={{ color: done ? 'var(--teal)' : 'var(--amber)', fontWeight: 700, flex: 'none' }}>{done ? '✓' : '›'}</span>
              {label}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/')}
        className="fc-btn-secondary"
        style={{ width: '100%', marginTop: 30 }}
      >
        Notify me on WhatsApp instead
      </button>
    </main>
  );
}
