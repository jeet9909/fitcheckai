import { useLocation, useNavigate } from 'react-router-dom';
import { PRODUCTS } from '../data/products';
import { fmt } from '../lib/format';
import { useAppState } from '../state/AppState';

export default function Handoff() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItems, resetFeedback } = useAppState();

  const stateIdx = (location.state as { cartIdx?: number } | null)?.cartIdx;
  const line = (stateIdx !== undefined ? cartItems[stateIdx] : undefined) ?? cartItems[0];
  const product = line ? PRODUCTS.find((p) => p.id === line.productId) : null;

  const simulateReturn = () => {
    resetFeedback();
    navigate('/feedback');
  };

  if (!product) {
    return (
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '80px 28px 100px', textAlign: 'center' }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Nothing to hand off yet.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '80px 28px 100px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>✓</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Your outfit is ready to purchase</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 32px' }}>You'll complete your purchase on the retailer's website.</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{product.store}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{product.name}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(product.price)}</div>
      </div>
      <button style={{ width: '100%', background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, padding: 15, borderRadius: 9, marginBottom: 10 }}>Continue to {product.store}</button>
      <button onClick={simulateReturn} style={{ width: '100%', background: 'none', border: '1px solid var(--border)', color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 600, padding: 12, borderRadius: 9 }}>Simulate return from store (demo) →</button>
    </main>
  );
}
