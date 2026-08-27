import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STEP_LABELS = [
  'Checking image quality',
  'Understanding body proportions',
  'Preparing your fit profile',
  'Generating preview',
  'Calculating fit confidence',
];

export default function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const afterRoute = (location.state as { afterRoute?: string } | null)?.afterRoute ?? '/tryon';
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((prev) => {
        const next = prev + 1;
        if (next >= STEP_LABELS.length) {
          window.clearInterval(timer);
          window.setTimeout(() => navigate(afterRoute, { replace: true }), 500);
        }
        return Math.min(next, STEP_LABELS.length);
      });
    }, 550);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 460, margin: '0 auto', padding: '100px 28px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', margin: '0 auto 28px', animation: 'fc-spin 1s linear infinite' }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 26px' }}>Analyzing your profile…</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
        {STEP_LABELS.map((label, i) => {
          const checked = step > i;
          const active = step === i;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, color: checked || active ? 'var(--ink)' : 'var(--ink-faint)' }}>
              <span
                style={{
                  width: 20, height: 20, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, background: checked ? 'var(--accent)' : 'var(--surface-alt)', color: checked ? '#fff' : 'var(--ink-faint)',
                  border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                  animation: active ? 'fc-pulse 1s ease infinite' : 'none',
                }}
              >
                {checked ? '✓' : ''}
              </span>
              {label}
            </div>
          );
        })}
      </div>
    </main>
  );
}
