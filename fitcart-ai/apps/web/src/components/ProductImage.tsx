import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Product } from '../data/products';
import { productImageUrl } from '../lib/productImage';
import Placeholder from './Placeholder';

interface ProductImageProps {
  product: Pick<Product, 'id' | 'category' | 'imageUrl'>;
  ratio?: string;
  radius?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function ProductImage({ product, ratio = '3/4', radius = 12, style, children }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Placeholder ratio={ratio} radius={radius} style={style}>
        {product.category}
        {children}
      </Placeholder>
    );
  }

  // Real/scraped products carry their own real product photo (product.imageUrl,
  // from the store's actual listing) — that must always win. The loremflickr
  // category-tag placeholder below is a random, unrelated stock photo and is
  // only a stand-in for legacy/curated rows that never had a real image.
  return (
    <div style={{ position: 'relative', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden', background: 'var(--surface-alt)', ...style }}>
      <img
        src={product.imageUrl || productImageUrl(product)}
        alt=""
        onError={() => setFailed(true)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {children}
    </div>
  );
}
