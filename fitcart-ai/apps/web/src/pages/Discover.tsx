import { useMemo, useState } from 'react';
import { BUCKETS, STORES } from '../data/products';
import { useAppState } from '../state/AppState';
import ProductCard from '../components/ProductCard';

// Amazon/Flipkart live search (StoreSearch) is commented out below until
// real affiliate API credentials are available to test against — see
// search-products Edge Function and supabase/README.md. Uncomment
// StoreSearch, its `searchStoreProducts` import from '../lib/api', and its
// <StoreSearch /> usage in the JSX below to re-enable.
//
// function StoreSearch() {
//   const { showToast, refreshProducts } = useAppState();
//   const [query, setQuery] = useState('');
//   const [store, setStore] = useState<'amazon' | 'flipkart'>('amazon');
//   const [searching, setSearching] = useState(false);
//
//   const runSearch = async () => {
//     if (!query.trim()) return;
//     setSearching(true);
//     const result = await searchStoreProducts(query.trim(), store);
//     setSearching(false);
//
//     if (!result.ok) {
//       showToast(result.message);
//       return;
//     }
//     if (result.count === 0) {
//       showToast(`No results from ${store === 'amazon' ? 'Amazon' : 'Flipkart'} for "${query}"`);
//       return;
//     }
//     showToast(`Found ${result.count} result(s) from ${store === 'amazon' ? 'Amazon' : 'Flipkart'}`);
//     await refreshProducts();
//   };
//
//   return (
//     <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
//       <select
//         value={store}
//         onChange={(e) => setStore(e.target.value as 'amazon' | 'flipkart')}
//         style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: 'var(--surface)' }}
//       >
//         <option value="amazon">Amazon</option>
//         <option value="flipkart">Flipkart</option>
//       </select>
//       <input
//         value={query}
//         onChange={(e) => setQuery(e.target.value)}
//         onKeyDown={(e) => e.key === 'Enter' && runSearch()}
//         placeholder="Search live listings, e.g. men's shirt"
//         style={{ flex: '1 1 240px', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: 'var(--surface)' }}
//       />
//       <button
//         onClick={runSearch}
//         disabled={searching || !query.trim()}
//         style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 8, opacity: searching ? 0.6 : 1 }}
//       >
//         {searching ? 'Searching…' : 'Search'}
//       </button>
//     </div>
//   );
// }

export default function Discover() {
  const { products, searchQuery } = useAppState();
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [storeFilter, setStoreFilter] = useState('All');

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) =>
      (categoryFilter === 'All' || p.bucket === categoryFilter) &&
      (storeFilter === 'All' || p.store === storeFilter) &&
      (!q || (p.name + ' ' + p.brand + ' ' + p.category).toLowerCase().includes(q))
    );
  }, [products, searchQuery, categoryFilter, storeFilter]);

  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 28px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Discover</h1>
        <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{filteredProducts.length} item(s) in your catalog</span>
      </div>
      {/* Commented out until real Amazon/Flipkart affiliate API credentials
          are available to test against — see StoreSearch above and
          supabase/README.md. Meesho/AJIO/Myntra/Nykaa Fashion are covered
          separately by the paste-a-link flow on Home (fetch-product). */}
      {/* <StoreSearch /> */}
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
      {filteredProducts.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: 0 }}>
            Nothing here yet. Paste a product link from Home to add a real listing.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20 }}>
          {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </main>
  );
}
