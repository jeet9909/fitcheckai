import { useAppState } from '../state/AppState';

const TIER_DEFS = [
  { key: 'guest', name: 'Guest', price: 'Free', tagline: 'Browse without an account', features: ['Cross-store discovery', 'Basic product details', 'No fit profile'], future: false },
  { key: 'style', name: 'Style', price: 'Free', tagline: 'Personal fit, unlocked', features: ['Everything in Guest', 'Personal fit profile', 'Fit Score on every item', 'Save outfits & wishlist'], future: false },
  { key: 'pro', name: 'Pro', price: '₹299/mo', tagline: 'For frequent shoppers', features: ['Everything in Style', 'Outfit Score & AI styling', 'Unlimited comparisons', 'Priority fit accuracy'], future: false },
  { key: 'studio', name: 'Studio', price: 'Coming soon', tagline: 'Full multi-angle studio', features: ['Everything in Pro', 'Extended multi-angle preview', 'Early access to new AI models'], future: true },
];

export default function Tiers() {
  const { tier, setTier } = useAppState();

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Plans</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px' }}>Fit and outfit intelligence, at the level you need.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
        {TIER_DEFS.map((t) => {
          const isCurrent = tier === t.key;
          return (
            <div key={t.key} style={{ border: `1.5px solid ${isCurrent ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 14, padding: 22, background: 'var(--surface)', opacity: t.future ? 0.85 : 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 12 }}>{t.tagline}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{t.price}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {t.features.map((f) => (
                  <div key={f} style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 7 }}><span style={{ color: 'var(--accent-dark)' }}>✓</span>{f}</div>
                ))}
              </div>
              {t.future ? (
                <div style={{ background: 'var(--surface-alt)', color: 'var(--ink-faint)', textAlign: 'center', fontSize: 12, fontWeight: 600, padding: 10, borderRadius: 8 }}>Coming soon</div>
              ) : (
                <button
                  onClick={() => setTier(t.key)}
                  style={{ width: '100%', background: isCurrent ? 'var(--surface-alt)' : 'var(--ink)', color: isCurrent ? 'var(--ink-faint)' : '#fff', border: 'none', fontSize: 12.5, fontWeight: 600, padding: 11, borderRadius: 8 }}
                >
                  {isCurrent ? 'Current plan' : 'Choose ' + t.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
