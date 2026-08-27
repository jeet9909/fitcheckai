import { useNavigate } from 'react-router-dom';
import { PRODUCTS } from '../data/products';
import { fitBg, fitColor, fmt } from '../lib/format';
import { useAppState } from '../state/AppState';
import ProductImage from '../components/ProductImage';

export default function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart } = useAppState();

  const lines = cartItems
    .map((c, idx) => {
      const product = PRODUCTS.find((p) => p.id === c.productId);
      return product ? { idx, qty: c.qty, product } : null;
    })
    .filter((l): l is { idx: number; qty: number; product: NonNullable<ReturnType<typeof PRODUCTS.find>> } => Boolean(l));

  const total = fmt(lines.reduce((a, c) => a + c.product.price * c.qty, 0));

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>Your Cart</h1>
      {lines.length === 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 14px' }}>Your cart is empty.</p>
          <button onClick={() => navigate('/discover')} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, padding: '11px 18px', borderRadius: 8 }}>Continue Shopping</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        {lines.map((c) => (
          <div key={c.idx} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
            <ProductImage product={c.product} ratio="1/1" radius={10} style={{ width: 76, height: 76, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{c.product.store}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.product.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={{ background: fitBg(c.product.fitScore), color: fitColor(c.product.fitScore), fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>Fit {c.product.fitScore}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{fmt(c.product.price)}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => removeFromCart(c.idx)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12, padding: 0 }}>Remove</button>
                <button onClick={() => navigate('/handoff', { state: { cartIdx: c.idx } })} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 7 }}>Checkout at {c.product.store}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {lines.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Total across stores</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{total}</div>
          </div>
          <button onClick={() => navigate('/discover')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, padding: '12px 20px', borderRadius: 9 }}>Continue Shopping</button>
        </div>
      )}
    </main>
  );
}
