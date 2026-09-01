// Flipkart Affiliate API — product search.
//
// Requires an approved Flipkart affiliate account (apply at
// affiliate.flipkart.com) — FLIPKART_AFFILIATE_ID and
// FLIPKART_AFFILIATE_TOKEN, issued after approval, set as secrets.
// isFlipkartConfigured() gates this; without them the caller returns an
// honest "not configured" response rather than any placeholder data.
//
// UNVERIFIED against a live account — implemented from Flipkart's published
// affiliate API response shape, not exercised against a real key here.

import type { StoreListing } from './types.ts';

function env(name: string): string {
  return Deno.env.get(name) ?? '';
}

export function isFlipkartConfigured(): boolean {
  return Boolean(env('FLIPKART_AFFILIATE_ID') && env('FLIPKART_AFFILIATE_TOKEN'));
}

interface FlipkartProduct {
  productBaseInfoV1?: {
    title?: string;
    brand?: string;
    imageUrls?: Record<string, string>;
    maximumRetailPrice?: { amount?: number };
    flipkartSellingPrice?: { amount?: number };
    productUrl?: string;
    inStock?: boolean;
  };
}

export async function searchFlipkart(query: string): Promise<StoreListing[]> {
  const affiliateId = env('FLIPKART_AFFILIATE_ID');
  const token = env('FLIPKART_AFFILIATE_TOKEN');

  const url = `https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'Fk-Affiliate-Id': affiliateId,
      'Fk-Affiliate-Token': token,
    },
  });

  if (!res.ok) {
    throw new Error(`Flipkart affiliate search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const products: FlipkartProduct[] = data?.products ?? [];

  return products
    .map((p): StoreListing | null => {
      const info = p.productBaseInfoV1;
      if (!info?.title || !info.productUrl) return null;
      const sellingPrice = info.flipkartSellingPrice?.amount ?? info.maximumRetailPrice?.amount ?? 0;
      const mrp = info.maximumRetailPrice?.amount ?? sellingPrice;
      const imageUrl = info.imageUrls ? Object.values(info.imageUrls)[0] ?? null : null;
      return {
        name: info.title,
        brand: info.brand ?? 'Unknown',
        price: Math.round(sellingPrice),
        mrp: Math.round(mrp),
        color: '',
        imageUrl,
        productUrl: info.productUrl,
        store: 'Flipkart',
      };
    })
    .filter((x): x is StoreListing => x !== null);
}
