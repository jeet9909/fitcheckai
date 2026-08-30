import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PaywallSheet from '../components/PaywallSheet';
import Placeholder from '../components/Placeholder';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthState';
import { supabase } from '../lib/supabase';
import { hasFreeRendersLeft, recordRenderUsed, rendersRemaining } from '../lib/renderGate';
import { startCheckout } from '../lib/checkout';
import { startRender, QuotaExceededError, type ProcessingResult, type RenderRow, type RegionRow } from '../lib/tryon';

interface ResultLocationState {
  result?: ProcessingResult;
}

interface Verdict {
  size: string;
  headline: string;
  detail: string;
  garment: string;
  price: string;
  imageUrl: string | null;
  regionBreakdown: RegionRow[] | null;
  renderId: number | null;
  productId: number | null;
  bodyProfileId: number | null;
}

const FALLBACK_VERDICT: Verdict = {
  size: 'L',
  headline: 'Go with L.',
  detail: "Snug across the chest in M. This brand runs about half a size small.",
  garment: 'H&M Oversized Tee',
  price: '₹799',
  imageUrl: null,
  regionBreakdown: null,
  renderId: null,
  productId: null,
  bodyProfileId: null,
};

function verdictFromRender(render: RenderRow): Verdict {
  return {
    size: render.size_recommended ?? 'M',
    headline: render.headline ?? 'Here’s your look.',
    detail: render.detail ?? '',
    garment: 'this garment',
    price: '',
    imageUrl: render.render_image_url,
    regionBreakdown: render.region_breakdown,
    renderId: render.id,
    productId: render.product_id,
    bodyProfileId: render.body_profile_id,
  };
}

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppState();
  const { user, isRealAccount } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [reRendering, setReRendering] = useState(false);

  const routeResult = (location.state as ResultLocationState | null)?.result;

  const verdict: Verdict = routeResult?.kind === 'done' ? verdictFromRender(routeResult.render) : FALLBACK_VERDICT;

  useEffect(() => {
    if (routeResult?.kind === 'quota_exceeded') {
      setPaywallOpen(true);
    } else if (routeResult?.kind === 'error') {
      showToast('Could not render your look — try again');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRender = async (): Promise<ProcessingResult> => {
    if (verdict.bodyProfileId == null) {
      // No real backend context to re-render from (mock/local fallback) —
      // fall through to the original demo navigation.
      return { kind: 'error', message: 'no-context' };
    }
    try {
      return { kind: 'done', render: await startRender(verdict.bodyProfileId, verdict.productId) };
    } catch (err) {
      return err instanceof QuotaExceededError ? { kind: 'quota_exceeded' } : { kind: 'error', message: String(err) };
    }
  };

  const handleTryAnotherSize = async () => {
    if (!hasFreeRendersLeft()) {
      setPaywallOpen(true);
      return;
    }
    if (verdict.bodyProfileId == null) {
      // Mock/local fallback path — no real render to redo.
      recordRenderUsed();
      showToast(`Re-rendering… ${rendersRemaining()} free look(s) left after this`);
      navigate('/processing', { state: { afterRoute: '/result' } });
      return;
    }

    setReRendering(true);
    const result = await runRender();
    setReRendering(false);

    if (result.kind === 'quota_exceeded') {
      setPaywallOpen(true);
      return;
    }
    if (result.kind === 'error') {
      showToast('Could not render your look — try again');
      return;
    }
    recordRenderUsed();
    navigate('/result', { replace: true, state: { result } });
  };

  const handleShare = () => {
    // TODO(backend/frontend): generate the 9:16 share card (Canvas/SVG) per
    // board C of the redesign — watermarked for free users, QR back to Home.
    if (navigator.share) {
      navigator.share({ title: 'FitCart AI', text: verdict.headline, url: window.location.href }).catch(() => {});
    } else {
      showToast('Share link copied');
    }
  };

  const handleSave = async () => {
    if (!isRealAccount) {
      navigate('/auth?redirect=/result');
      return;
    }
    if (!supabase) {
      showToast('Save isn’t connected yet — backend coming soon');
      return;
    }
    const { error } = await supabase.from('saved_looks').insert({
      user_id: user!.id,
      product_id: verdict.productId,
      render_url: verdict.imageUrl,
      verdict: {
        size: verdict.size,
        headline: verdict.headline,
        detail: verdict.detail,
        regionBreakdown: verdict.regionBreakdown,
      },
    });
    showToast(error ? 'Could not save — try again' : 'Saved to My Looks');
  };

  const handleBuy = () => {
    // TODO(backend): open the retailer with the affiliate tag attached,
    // per board D. Works for guests too — affiliate revenue never gated.
    showToast('Opening retailer with your recommended size…');
  };

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 100px' }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12.5, padding: 0, marginBottom: 14, cursor: 'pointer' }}>
        ← New look
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 20 }}>
        <div style={{ position: 'relative' }}>
          {verdict.imageUrl ? (
            <img
              src={verdict.imageUrl}
              alt="Your try-on render"
              style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 18, display: 'block' }}
            />
          ) : (
            <Placeholder ratio="4/5" radius={18} fontSize={12} padding={20}>
              YOUR RENDER — {verdict.garment}
            </Placeholder>
          )}
          {verdict.regionBreakdown?.map((row, i) => (
            <div
              key={row.label}
              style={{ position: 'absolute', top: `${18 + i * 20}%`, left: '10%', color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
            >
              {row.label.toLowerCase()} — {row.value.toLowerCase()}
            </div>
          ))}
        </div>

        <div style={{ border: '2px solid var(--teal)', background: 'var(--teal-soft)', borderRadius: 14, padding: '18px 20px' }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>{verdict.headline}</div>
          <div style={{ fontSize: 13.5, color: 'var(--teal)', lineHeight: 1.5 }}>{verdict.detail}</div>
        </div>

        {verdict.price && (
          <button onClick={handleBuy} className="fc-btn-primary">
            Buy at Myntra — size {verdict.size} — {verdict.price}
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <button onClick={handleShare} className="fc-btn-secondary">Share</button>
          <button onClick={handleSave} className="fc-btn-secondary">Save</button>
          <button onClick={handleTryAnotherSize} disabled={reRendering} className="fc-btn-secondary">
            {reRendering ? 'Rendering…' : 'Try another size'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', margin: 0 }}>
          AI estimate from your photo. Not a guaranteed measurement.
        </p>
      </div>

      <PaywallSheet
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onChoosePlan={async (plan) => {
          if (!isRealAccount) {
            navigate('/auth?redirect=/result');
            return;
          }
          setPaywallOpen(false);
          await startCheckout(plan, showToast);
        }}
      />
    </main>
  );
}
