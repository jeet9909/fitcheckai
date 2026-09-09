import { useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { STORES } from '../data/products';
import Placeholder from '../components/Placeholder';
import ProductCard from '../components/ProductCard';
import PriceCompareTeaser from '../components/PriceCompareTeaser';
import { useAppState } from '../state/AppState';

const EXAMPLE_QUERIES = [
  'Black oversized T-shirt under ₹1,000',
  'Casual shirts for a summer trip',
  'Something similar to this, but cheaper',
  'Fits me like my Roadster medium',
];

const HOW_IT_WORKS = [
  ['1', 'Find something you like', 'Search in plain language, or browse across every store FitCart connects to.'],
  ['2', 'Add one photo', 'A single full-body shot is all it takes — no measurements, no forms.'],
  ['3', 'See it, compare it, buy it', 'Preview it on yourself, compare it across stores, then check out on the retailer\'s own site.'],
] as const;

const PRIVACY_BULLETS = [
  'Photos are never shown to other shoppers.',
  'Photos are never used for advertising.',
  'One tap deletes every photo you have uploaded.',
];

const footerLinkStyle: CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer', textAlign: 'left',
};

export default function Landing() {
  const navigate = useNavigate();
  const { products, setSearchQuery } = useAppState();

  const trendingProducts = useMemo(() => products.slice(0, 8), [products]);
  // Best-effort candidate for the price-compare teaser — the component
  // itself renders nothing if this product turns out to have fewer than two
  // real store listings, so there's no risk of fabricating a comparison.
  const compareProductId = products[0]?.id;

  const runExampleQuery = (query: string) => {
    setSearchQuery(query);
    navigate('/discover');
  };

  return (
    <main>
      {/* ---------- HERO ---------- */}
      <section
        style={{
          maxWidth: 1200, margin: '0 auto', padding: '56px 28px 40px',
          display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 56, alignItems: 'center',
        }}
      >
        <div>
          <div className="fc-chip mono" style={{ background: 'var(--accent-soft)', color: 'var(--accent-dark)', marginBottom: 18, letterSpacing: '0.04em' }}>
            SIX STORES, ONE PLACE
          </div>
          <h1 className="display" style={{ fontSize: 46, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 18px' }}>
            Your personal AI shopping layer
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.55, color: 'var(--ink-soft)', margin: '0 0 28px', maxWidth: 460 }}>
            Search everywhere. Try anything on yourself. Compare the best options. Buy where you want.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={() => navigate('/discover')} className="fc-btn-primary" style={{ width: 'auto', padding: '15px 26px' }}>
              Start shopping
            </button>
            <button onClick={() => navigate('/setup')} className="fc-btn-secondary" style={{ padding: '15px 26px' }}>
              Try it on
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0, lineHeight: 1.5 }}>
            You check out on the retailer's own site. FitCart never handles your payment.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Placeholder ratio="3/4" radius={14} fontSize={11} padding={12}>CATALOG PHOTO</Placeholder>
            <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center', margin: '8px 0 0' }}>
              Catalog photo<br />As listed by the store
            </p>
          </div>
          <div>
            <Placeholder ratio="3/4" radius={14} fontSize={11} padding={12} style={{ border: '2px solid var(--teal)' }}>ON YOU</Placeholder>
            <p style={{ fontSize: 11.5, color: 'var(--teal)', fontWeight: 600, textAlign: 'center', margin: '8px 0 0' }}>
              On you<br />AI visualization from your photo
            </p>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ borderTop: '1px dashed var(--border)' }} />
      </div>

      {/* ---------- ASK IN PLAIN LANGUAGE ---------- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 0' }}>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
          Ask for what you want, in your own words
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 20px', maxWidth: 560 }}>
          FitCart reads plain language, so you do not have to guess the right filter.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => runExampleQuery(q)}
              className="fc-chip"
              style={{
                background: 'var(--surface-alt)', color: 'var(--ink)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 500, padding: '10px 16px', cursor: 'pointer',
              }}
            >
              "{q}"
            </button>
          ))}
        </div>
      </section>

      {/* ---------- STORES WE SEARCH ---------- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 28px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
          Stores we search
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {STORES.map((store) => (
            <div key={store} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
              {store}
            </div>
          ))}
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>More stores are added over time.</span>
        </div>
      </section>

      {/* ---------- TRENDING ---------- */}
      {trendingProducts.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Trending this week</h2>
            <button onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              See all results →
            </button>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 20px' }}>Most tried on by shoppers in your size range.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20 }}>
            {trendingProducts.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                {p.breakdown.length > 0 && (
                  <span
                    className="mono"
                    style={{
                      position: 'absolute', top: 8, left: 8, zIndex: 1,
                      background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontSize: 9.5, fontWeight: 700,
                      padding: '4px 10px', borderRadius: 100, letterSpacing: '0.03em',
                    }}
                  >
                    TRY-ON READY
                  </span>
                )}
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- PRICE COMPARE TEASER ---------- */}
      {compareProductId !== undefined && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 0' }}>
          <PriceCompareTeaser productId={compareProductId} />
        </section>
      )}

      {/* ---------- MINI CTA ---------- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 0' }}>
        <div style={{ padding: 32, borderRadius: 18, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', color: 'var(--accent-dark)' }}>Stop guessing from a flat photo.</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0, maxWidth: 440 }}>
              A catalog photo can't tell you how something sits on your body. One photo of you can.
            </p>
          </div>
          <button onClick={() => navigate('/setup')} className="fc-btn-primary" style={{ width: 'auto', padding: '15px 26px', flex: 'none' }}>
            See it on me
          </button>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 0' }}>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 24px' }}>How FitCart works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {HOW_IT_WORKS.map(([n, title, body]) => (
            <div key={n} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 14 }}>{n}</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- PRIVACY ---------- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px' }}>
        <div style={{ padding: 28, borderRadius: 16, border: '1px solid var(--teal)', background: 'var(--teal-soft)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 14px', color: 'var(--teal)' }}>Your photo stays yours.</h3>
          <ul style={{ margin: '0 0 16px', padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRIVACY_BULLETS.map((line) => (
              <li key={line} style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{line}</li>
            ))}
          </ul>
          <button onClick={() => navigate('/privacy')} className="fc-btn-secondary" style={{ width: 'auto', padding: '11px 20px' }}>
            Open privacy centre
          </button>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 28px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.3fr repeat(3, 1fr)', gap: 32 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
              Fit<span style={{ color: 'var(--accent)' }}>Cart</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6, margin: 0, maxWidth: 260 }}>
              FitCart is the fit and comparison layer across the stores you already shop — not a retailer itself.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 12 }}>Shop</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><button onClick={() => navigate('/discover')} style={footerLinkStyle}>Browse everything</button></li>
              <li><button onClick={() => navigate('/discover')} style={footerLinkStyle}>Compare stores</button></li>
              <li><button onClick={() => navigate('/setup')} style={footerLinkStyle}>Try something on</button></li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 12 }}>Guides</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><a href="#" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>How to pick a size online</a></li>
              <li><a href="#" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Oversized fit explained</a></li>
              <li><a href="#" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Best tees under ₹1,000</a></li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 12 }}>FitCart</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><button onClick={() => navigate('/privacy')} style={footerLinkStyle}>Privacy centre</button></li>
              <li><button onClick={() => navigate('/profile')} style={footerLinkStyle}>Appearance</button></li>
              <li><a href="#" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Help</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
