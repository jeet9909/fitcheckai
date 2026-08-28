import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STORES } from '../data/products';
import Placeholder from '../components/Placeholder';

/**
 * HOME = THE TOOL.
 *
 * This is the single-URL redesign from the UX plan (board B / board J):
 * no separate marketing landing page gating the product. The paste-link
 * tool sits above the fold; everything below the fold is the marketing
 * scroll (store trust, how-it-works, privacy) for search engines and
 * skeptical first-time visitors who want to read before they try.
 *
 * Two equal CTAs and a 60-item catalog-first flow (the old version of this
 * file) are exactly what the audit flagged as the biggest bounce risk —
 * removed on purpose. There is one primary action on this screen.
 */
export default function Landing() {
  const navigate = useNavigate();
  const [link, setLink] = useState('');

  const startFromLink = () => {
    // Real behaviour once the backend exists: POST the link to a
    // garment-parsing endpoint, then route to /setup with the parsed
    // product attached. For now this routes straight into the one-photo
    // flow so the front end is fully clickable end to end.
    navigate('/setup', { state: { sourceLink: link || null } });
  };

  return (
    <main>
      {/* ---------- ABOVE THE FOLD: THE TOOL ---------- */}
      <section
        style={{
          maxWidth: 1200, margin: '0 auto', padding: '56px 48px 40px',
          display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 56, alignItems: 'center',
        }}
      >
        <div>
          <div className="fc-chip" style={{ background: 'var(--teal-soft)', color: 'var(--teal)', marginBottom: 22 }}>
            No signup for your first look
          </div>
          <h1 className="display" style={{ fontSize: 50, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
            See it on you<br />before you buy it.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-soft)', margin: '0 0 28px', maxWidth: 460 }}>
            Paste a link from Myntra, AJIO or Amazon. We'll put the exact garment on your body and tell you the size to pick — in plain language.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a product link (myntra.com/...)"
              style={{
                flex: '1 1 300px', border: '1px solid var(--border)', borderRadius: 10,
                padding: '15px 16px', fontSize: 14.5, outline: 'none', background: 'var(--surface)',
              }}
            />
            <button
              onClick={startFromLink}
              className="fc-btn-primary"
              style={{ width: 'auto', padding: '15px 26px', flex: 'none' }}
            >
              See it on me
            </button>
          </div>
          <button
            onClick={() => navigate('/setup')}
            style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 13, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
          >
            or upload a photo of the garment instead
          </button>

          <div style={{ display: 'flex', gap: 20, marginTop: 34 }}>
            <span className="fc-chip" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>Photo auto-deleted in 24h</span>
            <span className="fc-chip" style={{ background: 'var(--surface-alt)', color: 'var(--ink-soft)' }}>2 free looks, no card needed</span>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Placeholder ratio="3/4" radius={14} fontSize={10} padding={10}>BEFORE / AFTER</Placeholder>
            <Placeholder ratio="3/4" radius={14} fontSize={10} padding={10}>BEFORE / AFTER</Placeholder>
            <Placeholder ratio="3/4" radius={14} fontSize={10} padding={10}>BEFORE / AFTER</Placeholder>
          </div>
          <div style={{ position: 'absolute', bottom: -18, left: -16, background: 'var(--surface)', border: '2px solid var(--teal)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 12px 28px rgba(20,20,20,0.12)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>"Go with L."</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>this brand runs small</div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ borderTop: '1px dashed var(--border)' }} />
      </div>

      {/* ---------- BELOW THE FOLD: THE MARKETING SCROLL ---------- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
          Shop across the stores you trust
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {STORES.slice(0, 4).map((sn) => (
            <div key={sn} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>{sn}</div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 48px' }}>
        <h2 className="display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 8px' }}>How it works</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 28px' }}>Paste a link → One photo → 20-second render → Plain verdict → Buy at the store</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {[
            ['1', 'Paste any product link', 'Or upload a photo of the garment — works with anything you can screenshot.'],
            ['2', 'One photo of you', 'A single full-body shot. No height, no weight, no forms — just one consent line.'],
            ['3', 'A verdict, not a score', '"Go with L" beats "91/100" — plain language you can act on immediately.'],
            ['4', 'Buy at the source', 'FitCart never owns checkout — you complete every purchase on the retailer\'s site.'],
          ].map(([n, title, body]) => (
            <div key={n} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 14 }}>{n}</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px 56px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ padding: 28, borderRadius: 16, background: 'var(--accent-soft)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--accent-dark)' }}>FitCart is the mirror, not the store.</h3>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
            Myntra, AJIO and Amazon are where you buy. FitCart is the last check before Buy — turning a product photo into a personal answer for your body.
          </p>
        </div>
        <div style={{ padding: 28, borderRadius: 16, border: '1px solid var(--teal)', background: 'var(--teal-soft)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--teal)' }}>Privacy-first, by design.</h3>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 12px' }}>
            Your photo is used only to render this look, and auto-deleted in 24 hours unless you save it. Delete everything, anytime, one tap.
          </p>
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, fontWeight: 600, padding: 0, cursor: 'pointer' }}>
            See how your data is handled →
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px 96px', textAlign: 'center' }}>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px' }}>Ready to see how it fits?</h2>
        <button onClick={startFromLink} className="fc-btn-primary" style={{ width: 'auto', padding: '15px 30px' }}>
          See it on me
        </button>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 48px', display: 'flex', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto', fontSize: 12, color: 'var(--ink-faint)' }}>
        <span>FitCart AI — fit and outfit intelligence, not a retailer.</span>
        <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12, cursor: 'pointer' }}>Privacy</button>
      </footer>
    </main>
  );
}
