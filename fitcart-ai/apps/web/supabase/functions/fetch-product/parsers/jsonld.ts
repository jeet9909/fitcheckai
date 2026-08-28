import type { ParsedProduct } from './types.ts';

/**
 * Many product pages embed a schema.org/Product block in
 * <script type="application/ld+json">. This is the most reliable
 * plain-fetch signal (no JS execution needed) when a site includes it.
 * Store-specific parsers should try this first, then fall back to
 * regex/DOM scraping of visible markup if it's absent.
 */
export function extractJsonLdProduct(html: string): Partial<ParsedProduct> | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])];
      const product = candidates.find((c) => c && (c['@type'] === 'Product' || c['@type']?.includes?.('Product')));
      if (!product) continue;

      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const price = offer?.price ? Number(offer.price) : undefined;
      const image = Array.isArray(product.image) ? product.image[0] : product.image;

      return {
        name: product.name,
        brand: typeof product.brand === 'string' ? product.brand : product.brand?.name,
        price,
        imageUrl: image ?? null,
      };
    } catch {
      // malformed JSON-LD block — skip it, try the next script tag
      continue;
    }
  }
  return null;
}
