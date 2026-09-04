import type { Parser } from './types.ts';
import { extractJsonLdProduct } from './jsonld.ts';

// Before enabling in production: check https://www.ajio.com/robots.txt for
// Disallow rules covering /p/... product-page paths.
//
// Known limitation: AJIO is a heavily client-rendered (React) storefront —
// most of the visible page, including price and size chart, is built by JS
// after load. JSON-LD (when the page includes it) is the only signal a
// plain fetch() can reliably read here. If absent, this returns null rather
// than trying to reverse-engineer the JS bundle.
export const parse: Parser = (html, _url) => {
  const jsonLd = extractJsonLdProduct(html);
  if (!jsonLd?.name || !jsonLd.price) return null;

  return {
    name: jsonLd.name,
    brand: jsonLd.brand ?? 'Unknown',
    price: jsonLd.price,
    mrp: jsonLd.price,
    color: '',
    imageUrl: jsonLd.imageUrl ?? null,
    // Size chart is genuinely unreachable via plain fetch here (see the
    // header comment above). `description`/`material`/`imageUrls` come
    // straight from the JSON-LD block when it states them; `null`/`[]`
    // (never fabricated) when it doesn't.
    sizeChart: null,
    description: jsonLd.description ?? null,
    material: jsonLd.material ?? null,
    imageUrls: jsonLd.imageUrls ?? [],
  };
};
