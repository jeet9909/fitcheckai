import { useMemo, useState } from 'react';
import { BUCKETS, PRODUCTS, STORES } from '../data/products';
import { useAppState } from '../state/AppState';
import ProductCard from '../components/ProductCard';

export default function Discover() {
  const { searchQuery } = useAppState();
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [storeFilter, setStoreFilter] = useState('All');

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PRODUCTS.filter((p) =>
      (categoryFilter === 'All' || p.bucket === categoryFilter) &&
      (storeFilter === 'All' || p.store === storeFilter) &&
      (!q || (p.name + ' ' + p.brand + ' ' + p.category).toLowerCase().includes(q))
    );
  }, [searchQuery, categoryFilter, storeFilter]);

  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 28px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Discover</h1>
        <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{filteredProducts.length} items across 6 stores</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {BUCKETS.map((b) => {
          const active = categoryFilter === b;
          return (
            <button
              key={b}
              onClick={() => setCategoryFilter(b)}
              style={{ border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--ink)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-soft)', fontSize: 13, fontWeight: 500, padding: '8px 16px', borderRadius: 20 }}
            >
              {b}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {['All', ...STORES].map((st) => {
          const active = storeFilter === st;
          return (
            <button
              key={st}
              onClick={() => setStoreFilter(st)}
              style={{ border: `1px solid ${active ? 'var(--accent-dark)' : 'var(--border)'}`, background: active ? 'var(--accent-soft)' : 'var(--surface)', color: active ? 'var(--accent-dark)' : 'var(--ink-faint)', fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 14 }}
            >
              {st}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20 }}>
        {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </main>
  );
}
