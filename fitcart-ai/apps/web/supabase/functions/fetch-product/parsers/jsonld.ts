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

      // `image` on a real schema.org/Product block is sometimes a single
      // string, sometimes an array of every gallery shot — when it's an
      // array, every real (string, non-empty) entry becomes `imageUrls`
      // too, not just the first one used for `imageUrl` above. No cap
      // applied here (callers that need one, e.g. fetch-product/index.ts's
      // enrichment wiring via curate-product's updateProduct, already
      // enforce their own MAX_IMAGE_URLS before writing).
      const imageUrls = Array.isArray(product.image)
        ? product.image.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.length > 0)
        : [];

      // `description`/`material` are only ever set here when the JSON-LD
      // block itself states them explicitly — schema.org/Product does
      // define both properties, but neither is guaranteed present; a page
      // that omits them correctly yields `undefined` here (never a
      // fabricated placeholder), which each store parser then maps to
      // `null`.
      const description = typeof product.description === 'string' && product.description.trim().length > 0
        ? product.description.trim()
        : undefined;
      const material = typeof product.material === 'string' && product.material.trim().length > 0
        ? product.material.trim()
        : undefined;

      return {
        name: product.name,
        brand: typeof product.brand === 'string' ? product.brand : product.brand?.name,
        price,
        imageUrl: image ?? null,
        description,
        material,
        imageUrls,
      };
    } catch {
      // malformed JSON-LD block — skip it, try the next script tag
      continue;
    }
  }
  return null;
}
