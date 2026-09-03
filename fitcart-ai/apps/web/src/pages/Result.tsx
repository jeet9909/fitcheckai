import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PaywallSheet from '../components/PaywallSheet';
import Placeholder from '../components/Placeholder';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import { useAuth } from '../state/AuthState';
import { supabase } from '../lib/supabase';
import { hasFreeRendersLeft, recordRenderUsed, rendersRemaining } from '../lib/renderGate';
import { startCheckout } from '../lib/checkout';

/**
 * THE AHA. One garment, one body, one plain-language verdict.
 *
 * TODO(backend): this screen currently reads a mock verdict. Wire it to the
 * real render + verdict API once that exists — see the "backend handoff"
 * section of the redesign prompt for the expected request/response shape.
 */
export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const { products, showToast } = useAppState();
  const { user } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Forwarded from ProductDetail/ProductCard/StoreSearch through Setup ->
  // Processing -> here, so this screen can say which real catalog product
  // the try-on was actually for. Absent entirely for the upload-only /
  // paste-a-link flows (no catalog product involved) — that's expected, not
  // an error.
  const productId = (location.state as { productId?: number | null } | null)?.productId ?? null;
  const product = productId != null ? products.find((p) => p.id === productId) ?? null : null;

  // Mock fit verdict — replace with the real render + verdict API response.
  // Garment identity (name/store/price) is real when we know which catalog
  // product this render was for; falls back to a placeholder garment only
  // when there isn't one (upload-only flow).
  const verdict = {
    size: 'L',
    headline: 'Go with L.',
    detail: "Snug across the chest in M. This brand runs about half a size small.",
    garment: product?.name ?? 'H&M Oversized Tee',
    price: product ? fmt(product.price) : '₹799',
    store: product?.store ?? 'Myntra',
  };

  const handleTryAnotherSize = () => {
    if (!hasFreeRendersLeft()) {
      setPaywallOpen(true);
      return;
    }
    recordRenderUsed();
    showToast(`Re-rendering… ${rendersRemaining()} free look(s) left after this`);
    navigate('/processing', { state: { afterRoute: '/result', productId } });
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
    if (!user) {
      navigate('/auth?redirect=/result');
      return;
    }
    if (!supabase) {
      showToast('Save isn’t connected yet — backend coming soon');
      return;
    }
    const { error } = await supabase.from('saved_looks').insert({
      user_id: user.id,
      verdict,
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
          <Placeholder ratio="4/5" radius={18} fontSize={12} padding={20}>
            YOUR RENDER — {verdict.garment}
          </Placeholder>
          {/* Tailor's-chalk callouts, per board C — swap for real coordinates from the vision model */}
          <div style={{ position: 'absolute', top: '18%', left: '10%', color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            shoulder — spot on
          </div>
          <div style={{ position: 'absolute', top: '38%', left: '10%', color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            chest — 2cm snug
          </div>
          <div style={{ position: 'absolute', top: '68%', left: '10%', color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            length — sits at hip
          </div>
        </div>

        <div style={{ border: '2px solid var(--teal)', background: 'var(--teal-soft)', borderRadius: 14, padding: '18px 20px' }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>{verdict.headline}</div>
          <div style={{ fontSize: 13.5, color: 'var(--teal)', lineHeight: 1.5 }}>{verdict.detail}</div>
        </div>

        <button onClick={handleBuy} className="fc-btn-primary">
          Buy at {verdict.store} — size {verdict.size} — {verdict.price}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <button onClick={handleShare} className="fc-btn-secondary">Share</button>
          <button onClick={handleSave} className="fc-btn-secondary">Save</button>
          <button onClick={handleTryAnotherSize} className="fc-btn-secondary">Try another size</button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', margin: 0 }}>
          AI estimate from your photo. Not a guaranteed measurement.
        </p>
      </div>

      <PaywallSheet
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onChoosePlan={async (plan) => {
          if (!user) {
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
