import type { Product } from '../data/products';
import { findSimilarProducts } from '../lib/similarProducts';
import ProductCard from './ProductCard';

export default function SimilarProducts({ product, allProducts }: { product: Product; allProducts: Product[] }) {
  const similar = findSimilarProducts(product, allProducts);
  if (similar.length === 0) return null;

  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Similar products</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 18 }}>
        {similar.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
