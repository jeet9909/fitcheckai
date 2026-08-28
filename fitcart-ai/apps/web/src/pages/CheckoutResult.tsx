import { useNavigate } from 'react-router-dom';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  return (
    <main style={{ maxWidth: 460, margin: '0 auto', padding: '100px 28px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--teal-soft)', color: 'var(--teal)', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>✓</div>
      <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>You're in.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px' }}>Your plan is active. Head back and keep going.</p>
      <button onClick={() => navigate('/result')} className="fc-btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
        Back to your look
      </button>
    </main>
  );
}

export function CheckoutCancel() {
  const navigate = useNavigate();
  return (
    <main style={{ maxWidth: 460, margin: '0 auto', padding: '100px 28px', textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Checkout cancelled</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px' }}>No charge was made. You can try again anytime.</p>
      <button onClick={() => navigate('/result')} className="fc-btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
        Back to your look
      </button>
    </main>
  );
}
