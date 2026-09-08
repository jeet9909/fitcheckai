import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PaywallSheet from '../components/PaywallSheet';
import Placeholder from '../components/Placeholder';
import SimilarProducts from '../components/SimilarProducts';
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
  const [showOriginal, setShowOriginal] = useState(false);

  // Forwarded from ProductDetail/ProductCard/StoreSearch through Setup ->
  // Processing -> here, so this screen can say which real catalog product
  // the try-on was actually for. Absent entirely for the upload-only /
  // paste-a-link flows (no catalog product involved) — that's expected, not
  // an error.
  const productId = (location.state as { productId?: number | null } | null)?.productId ?? null;
  const product = productId != null ? products.find((p) => p.id === productId) ?? null : null;

  // TODO(backend): everything below is a mock verdict — replace with the
  // real render + verdict API response. Garment identity (name/brand/store/
  // price) is real when we know which catalog product this render was for;
  // falls back to placeholder garment details only when there isn't one
  // (upload-only flow). The "SAMPLE DATA" tag on the fit estimate card below
  // exists specifically to be honest with users that this part is mocked.
  const verdict = {
    size: 'M',
    confidence: 82,
    headline: 'Size M looks like the better match',
    garment: product?.name ?? 'H&M Oversized Tee',
    brand: product?.brand ?? 'H&M',
    price: product ? fmt(product.price) : '₹799',
    store: product?.store ?? 'Myntra',
    breakdown: [
      { part: 'Shoulder', descriptor: 'Aligned' },
      { part: 'Chest', descriptor: 'Comfortable room' },
      { part: 'Waist', descriptor: 'Loose, as intended' },
      { part: 'Length', descriptor: 'Sits at the hip' },
      { part: 'Sleeve', descriptor: 'Slightly long' },
    ],
  };

  // Simple two-size ladder for the "try the other size" nudge — swap for a
  // real adjacent-size lookup against the brand's size chart once available.
  const otherSize = verdict.size === 'M' ? 'L' : 'M';

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

  const handleTryOutfit = () => {
    // No outfit-builder flow exists yet — stub that points people at Discover
    // instead of inventing a page. Revisit once that flow is designed.
    showToast('Outfit builder is coming soon — browse more in Discover for now');
    navigate('/discover');
  };

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12.5, padding: 0, cursor: 'pointer' }}>
          ← New look
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleShare} className="fc-btn-secondary" style={{ padding: '6px 14px', fontSize: 12.5 }}>
            Share
          </button>
          <button onClick={handleSave} className="fc-btn-secondary" style={{ padding: '6px 14px', fontSize: 12.5 }}>
            Save
          </button>
        </div>
      </div>

      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 16px' }}>
        Here it is on you
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 20 }}>
        <div>
          <div style={{ position: 'relative' }}>
            <Placeholder ratio="4/5" radius={18} fontSize={12} padding={20}>
              {showOriginal ? `ORIGINAL CATALOG PHOTO — ${verdict.garment}` : `YOUR RENDER — ${verdict.garment}`}
            </Placeholder>
          </div>
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className="fc-btn-secondary"
            style={{ marginTop: 10, width: '100%', fontSize: 12.5 }}
            aria-pressed={showOriginal}
          >
            {showOriginal ? 'Show my try-on' : 'Original catalog photo'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', margin: '6px 0 0' }}>
            Tap to compare side by side
          </p>
          <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.5 }}>
            This is an AI visualization, not a photo of the real garment on you. Colour, drape and texture can differ.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4 }}>{verdict.brand}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{verdict.garment}</div>
          <div style={{ fontSize: 14, color: 'var(--ink-faint)' }}>
            {verdict.price} · {verdict.store} · Size {verdict.size}
          </div>
        </div>

        <button onClick={handleBuy} className="fc-btn-primary">
          Buy on {verdict.store} for {verdict.price}
        </button>

        <div style={{ border: '2px solid var(--teal)', background: 'var(--teal-soft)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Fit estimate
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: 'var(--ink-faint)',
                background: 'var(--paper)',
                border: '1px solid var(--hairline)',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              SAMPLE DATA
            </span>
          </div>

          <div className="display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)', marginBottom: 2 }}>
            {verdict.headline}
          </div>
          <div style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 14 }}>{verdict.confidence}% confidence</div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Why this size
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {verdict.breakdown.map((row) => (
              <li key={row.part} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--teal)' }}>
                <span>{row.part}</span>
                <span style={{ fontWeight: 600 }}>{row.descriptor}</span>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 11, color: 'var(--teal)', lineHeight: 1.5, margin: '14px 0 12px' }}>
            An estimate from your photo, your saved measurements and this brand's size chart. It is not a guarantee of fit.
          </p>

          <button onClick={handleTryAnotherSize} className="fc-btn-secondary" style={{ width: '100%' }}>
            Try size {otherSize} instead
          </button>
        </div>

        {product && (
          <section style={{ marginTop: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Complete the look</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '0 0 16px' }}>
              Pieces that work with what you just tried on.
            </p>
            <SimilarProducts product={product} allProducts={products} />
            <button onClick={handleTryOutfit} className="fc-btn-secondary" style={{ width: '100%', marginTop: 16 }}>
              Try the complete outfit
            </button>
          </section>
        )}
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
