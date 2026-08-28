import type { Parser } from './types.ts';
import { extractJsonLdProduct } from './jsonld.ts';

// Before enabling in production: check https://www.meesho.com/robots.txt
// for Disallow rules covering product-page paths.
//
// Known limitation: Meesho's storefront is client-rendered; a plain fetch
// only reliably sees JSON-LD when the page includes it. Size charts are not
// reachable without a headless browser.
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
