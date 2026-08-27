import { useNavigate } from 'react-router-dom';
import { STORES } from '../data/products';
import Placeholder from '../components/Placeholder';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 48px 40px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, marginBottom: 22 }}>
            AI fit &amp; outfit intelligence
          </div>
          <h1 style={{ fontSize: 52, lineHeight: 1.06, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 22px' }}>
            Know how it fits before you buy.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--ink-soft)', margin: '0 0 34px', maxWidth: 480 }}>
            AI-powered fit and outfit intelligence across the stores you already shop — Myntra, AJIO, Amazon, Flipkart, Meesho and Nykaa Fashion.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/discover')} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, padding: '15px 26px', borderRadius: 9 }}>Start Styling</button>
            <button onClick={() => navigate('/tryon')} style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)', fontSize: 15, fontWeight: 600, padding: '15px 26px', borderRadius: 9 }}>Explore How It Works</button>
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 40 }}>
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>91%</div><div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>avg. fit confidence</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>6</div><div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>stores connected</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>0</div><div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>body photos stored without consent</div></div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Placeholder ratio="3/4" radius={18} fontSize={11} padding={20}>MULTI-ANGLE AI PREVIEW<br />(product photography placeholder)</Placeholder>
          <div style={{ position: 'absolute', top: 20, right: -16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 12px 28px rgba(20,20,20,0.1)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>Fit Score</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-dark)' }}>91<span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
          </div>
          <div style={{ position: 'absolute', bottom: 24, left: -16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 12px 28px rgba(20,20,20,0.1)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>Outfit Score</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>87<span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 500 }}>/100</span></div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 16 }}>Shop across the stores you trust</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {STORES.map((sn) => (
            <div key={sn} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>{sn}</div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 48px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 8px' }}>How it works</h2>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '0 0 32px' }}>Discover → Personalize → Preview → Understand → Shop</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {[
            ['1', 'Discover across stores', 'Browse clothing, shoes and accessories from six retailers in one place.'],
            ['2', 'Build your fit profile', "A quick, consent-first photo and measurement setup — delete it anytime."],
            ['3', 'Preview & understand', 'Multi-angle AI preview with a Fit Score and Outfit Score, each with a confidence level.'],
            ['4', 'Shop at the source', "FitCart never owns checkout — you complete every purchase on the retailer's site."],
          ].map(([n, title, body]) => (
            <div key={n} style={{ padding: 22, border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{n}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div style={{ padding: 32, borderRadius: 16, background: 'var(--surface-alt)' }}>
          <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px' }}>FitCart is how you decide.</h3>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
            Myntra, AJIO, Amazon, Flipkart, Meesho and Nykaa Fashion are where you buy. FitCart sits between you and every store, turning product photos into a personal answer: will this fit, and does it work as an outfit.
          </p>
        </div>
        <div style={{ padding: 32, borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px' }}>Privacy-first, by design.</h3>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Body data is sensitive. Every AI output carries a confidence level, and your photos and measurements can be deleted at any time.
          </p>
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', fontSize: 13, fontWeight: 600, padding: 0 }}>See how your data is handled →</button>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 96px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>Ready to see how it fits?</h2>
        <button onClick={() => navigate('/discover')} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, padding: '15px 30px', borderRadius: 9 }}>Start Styling</button>
      </section>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 48px', display: 'flex', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto', fontSize: 12, color: 'var(--ink-faint)' }}>
        <span>FitCart AI — fit and outfit intelligence, not a retailer.</span>
        <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12 }}>Studio console</button>
      </footer>
    </main>
  );
}
