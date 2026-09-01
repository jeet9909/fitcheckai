export interface StoreListing {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  productUrl: string;
  store: 'Amazon' | 'Flipkart';
}
