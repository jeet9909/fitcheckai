import type { Parser } from './types.ts';
import { extractJsonLdProduct } from './jsonld.ts';

// Before enabling in production: check https://www.nykaafashion.com/robots.txt
// for Disallow rules covering product-page paths.
//
// Known limitation: same class of issue as the other storefronts here —
// price/size chart are client-rendered; JSON-LD (when present) is the
// reliable signal, otherwise this returns null.
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
    sizeChart: null,
  };
};
