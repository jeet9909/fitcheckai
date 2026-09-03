import type { Product } from '../data/products';

const MAX_SIMILAR = 8;

/**
 * "Similar" here means "same bucket, closest price" — the one honest,
 * explainable ordering signal this catalog actually has. `bucket` (the
 * coarse Discover-style category: Clothing/Shoes/Accessories/…) is used
 * rather than `category`, which is frequently 'Unknown' on scraped listings
 * (see fetch-product/index.ts's upsert) and far less consistent across
 * sources — see Discover.tsx, which filters the same way for the same
 * reason. There's no real popularity/relevance signal in this catalog, so
 * this deliberately doesn't invent one.
 */
export function findSimilarProducts(product: Product, allProducts: Product[]): Product[] {
  return allProducts
    .filter((p) => p.id !== product.id && p.bucket === product.bucket)
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price))
    .slice(0, MAX_SIMILAR);
}
