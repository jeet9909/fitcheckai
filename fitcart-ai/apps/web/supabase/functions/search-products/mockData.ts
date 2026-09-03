// Mock marketplace data — dev/demo-only stand-in for the real Amazon
// Creators API / Flipkart Affiliate API calls, gated behind the
// MOCK_MARKETPLACES Deno secret. When active, the orchestrator skips
// configured()/search() entirely for every provider and returns these
// listings with status 'mock' instead.
//
// IMPORTANT: never enable this on a production Supabase project. Mock rows
// are persisted with `source = '<store>-mock'` (see schema.sql), reusing the
// existing free-text `source` column rather than a schema change — but if a
// production project ever ran with MOCK_MARKETPLACES set, demo rows would
// blend into the real catalog with no structural separation beyond that
// string. Dev/local/staging only.

import type { StoreListing } from './types.ts';

type Store = StoreListing['store'];

export function isMockMode(): boolean {
  const raw = (Deno.env.get('MOCK_MARKETPLACES') ?? '').trim().toLowerCase();
  return raw === 'true';
}

// Fixed, deterministic set per store so tests (and manual QA) get stable
// output for a given (store, query) pair — no randomness, no clock reads.
const MOCK_TEMPLATES: Record<Store, { brand: string; price: number; mrp: number; color: string; slug: string }[]> = {
  Amazon: [
    { brand: 'MockWear', price: 799, mrp: 1299, color: 'Blue', slug: 'amazon-1' },
    { brand: 'DemoThreads', price: 1199, mrp: 1999, color: 'Black', slug: 'amazon-2' },
    { brand: 'SampleStyle', price: 549, mrp: 899, color: 'White', slug: 'amazon-3' },
  ],
  Flipkart: [
    { brand: 'MockWear', price: 699, mrp: 1099, color: 'Grey', slug: 'flipkart-1' },
    { brand: 'DemoThreads', price: 1399, mrp: 2199, color: 'Navy', slug: 'flipkart-2' },
    { brand: 'SampleStyle', price: 449, mrp: 799, color: 'Red', slug: 'flipkart-3' },
  ],
  Meesho: [
    { brand: 'MockWear', price: 349, mrp: 699, color: 'Pink', slug: 'meesho-1' },
    { brand: 'DemoThreads', price: 449, mrp: 899, color: 'Yellow', slug: 'meesho-2' },
  ],
  Myntra: [
    { brand: 'MockWear', price: 999, mrp: 1799, color: 'Maroon', slug: 'myntra-1' },
    { brand: 'SampleStyle', price: 1249, mrp: 2499, color: 'Olive', slug: 'myntra-2' },
  ],
  AJIO: [
    { brand: 'DemoThreads', price: 799, mrp: 1599, color: 'Beige', slug: 'ajio-1' },
    { brand: 'SampleStyle', price: 1099, mrp: 1999, color: 'Green', slug: 'ajio-2' },
  ],
  'Nykaa Fashion': [
    { brand: 'MockWear', price: 899, mrp: 1499, color: 'Rust', slug: 'nykaafashion-1' },
    { brand: 'DemoThreads', price: 1599, mrp: 2999, color: 'Teal', slug: 'nykaafashion-2' },
  ],
};

// Deliberately obviously-fake — example.com is IANA-reserved for
// documentation/testing and will never resolve to a real store, so a mock
// listing can never be mistaken for (or accidentally clicked through to) a
// real amazon.in/flipkart.com product page.
function mockUrl(store: Store, slug: string): string {
  return `https://example.com/mock-listing/${store.toLowerCase()}/${slug}`;
}

function mockImageUrl(store: Store, slug: string): string {
  return `https://example.com/mock-image/${store.toLowerCase()}/${slug}.jpg`;
}

export function generateMockListings(store: Store, query: string): StoreListing[] {
  const templates = MOCK_TEMPLATES[store] ?? [];
  const safeQuery = query.trim() || 'item';

  return templates.map((t): StoreListing => ({
    name: `[MOCK] ${safeQuery} — ${t.brand}`,
    brand: t.brand,
    price: t.price,
    mrp: t.mrp,
    color: t.color,
    imageUrl: mockImageUrl(store, t.slug),
    productUrl: mockUrl(store, t.slug),
    store,
    source: 'mock',
  }));
}
