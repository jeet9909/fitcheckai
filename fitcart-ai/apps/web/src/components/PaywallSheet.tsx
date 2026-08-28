interface PaywallSheetProps {
  open: boolean;
  onClose: () => void;
  onChoosePlan: (plan: 'day' | 'pro' | 'year') => void;
}

/**
 * The one and only paywall surface in the product. Fires as a bottom sheet
 * over the dimmed previous screen (never a full route — see board D/F of
 * the UX redesign). Triggered by: 3rd render attempt, "remove watermark"
 * tap, or "download HD" tap.
 */
export default function PaywallSheet({ open, onClose, onChoosePlan }: PaywallSheetProps) {
  if (!open) return null;

  return (
    <div className="fc-sheet-backdrop" onClick={onClose}>
      <div className="fc-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 3, margin: '0 auto 18px' }} />

        <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>
          You've used your 2 free looks
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
          Keep going for the price of a chai.
        </p>

        <button
          onClick={() => onChoosePlan('day')}
          style={{
            width: '100%', textAlign: 'left', background: 'var(--accent-soft)',
            border: '2px solid var(--accent)', borderRadius: 14, padding: '16px 18px',
            marginBottom: 12, cursor: 'pointer', position: 'relative',
          }}
        >
          <span className="fc-chip" style={{ position: 'absolute', top: -11, right: 14, background: 'var(--accent)', color: '#fff' }}>
            most picked
          </span>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Day Pass — ₹19</div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.5 }}>
            10 looks, next 24 hours · No watermark, HD download · One UPI tap, nothing recurring
          </div>
        </button>

        <button
          onClick={() => onChoosePlan('pro')}
          style={{
            width: '100%', textAlign: 'left', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px',
            marginBottom: 20, cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Pro — ₹149/month</div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.5 }}>
            100 looks a month · Saved size history · Priority queue · Cancel anytime
          </div>
        </button>

        <button className="fc-btn-primary" onClick={() => onChoosePlan('day')}>
          Pay ₹19 with UPI
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <button onClick={() => onChoosePlan('year')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-faint)', textDecoration: 'underline', cursor: 'pointer' }}>
            ₹999/year (save 44%)
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-soft)', cursor: 'pointer' }}>
            Not now, see my saved looks
          </button>
        </div>
      </div>
    </div>
  );
}
