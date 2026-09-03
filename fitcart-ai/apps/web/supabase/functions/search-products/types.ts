export interface StoreListing {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  productUrl: string;
  // Must exactly match the `store` string fetch-product/index.ts's
  // STORE_PARSERS table writes to products.store for each host — this is
  // what lets localCatalog.ts's cache lookups match rows created via the
  // single-URL paste flow, not just rows this function itself wrote.
  store: 'Amazon' | 'Flipkart' | 'Meesho' | 'Myntra' | 'AJIO' | 'Nykaa Fashion';
  // Set by the orchestrator (not by the individual adapter files) — 'live'
  // for a real upstream API response, 'mock' for MOCK_MARKETPLACES-generated
  // demo data, 'scraped' for a listing pulled from the scraping fallback
  // (search-products/scraping/) when the real API isn't configured. Optional
  // only so existing call sites that construct a StoreListing without it
  // (e.g. adapter unit tests) still type-check; the orchestrator always
  // fills it in before a listing reaches index.ts.
  source?: 'live' | 'mock' | 'scraped';
}
