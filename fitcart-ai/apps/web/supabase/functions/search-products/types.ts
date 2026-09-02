export interface StoreListing {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  productUrl: string;
  store: 'Amazon' | 'Flipkart';
  // Set by the orchestrator (not by the individual adapter files) — 'live'
  // for a real upstream API response, 'mock' for MOCK_MARKETPLACES-generated
  // demo data. Optional only so existing call sites that construct a
  // StoreListing without it (e.g. adapter unit tests) still type-check;
  // the orchestrator always fills it in before a listing reaches index.ts.
  source?: 'live' | 'mock';
}
