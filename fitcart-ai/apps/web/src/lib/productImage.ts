import type { Product } from '../data/products';

const CATEGORY_TAGS: Record<string, string> = {
  Shirts: 'mens,shirt,fashion',
  Trousers: 'chinos,trousers,mens',
  Sneakers: 'sneakers,shoes',
  Watches: 'wristwatch,watch',
  Jackets: 'jacket,mens,fashion',
  Jeans: 'jeans,denim',
  Sunglasses: 'sunglasses,fashion',
  Accessories: 'tote,bag,canvas',
  Sweaters: 'sweater,knitwear',
  Boots: 'boots,leather,shoes',
};

export function productImageUrl(product: Pick<Product, 'id' | 'category'>, width = 600, height = 800): string {
  const tag = CATEGORY_TAGS[product.category] ?? 'fashion,clothing';
  return `https://loremflickr.com/${width}/${height}/${tag}?lock=${product.id}`;
}
