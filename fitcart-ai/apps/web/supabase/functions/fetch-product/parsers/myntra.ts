import type { Parser } from './types.ts';
import { extractJsonLdProduct } from './jsonld.ts';

// Before enabling in production: check https://www.myntra.com/robots.txt
// for any Disallow rules covering /<brand>/<product>/... product-page paths.
//
// Known limitation: Myntra's product page hydrates price, size chart, and
// often the gallery via client-side JS/XHR after initial load. A plain
// fetch() only sees the server-rendered shell, so JSON-LD (when present) is
// the most reliable signal here; size charts are effectively unreachable
// without a headless browser (out of scope for an Edge Function — flagged
// as a follow-up, not something fixable with more regex).
export const parse: Parser = (html, _url) => {
  const jsonLd = extractJsonLdProduct(html);
  if (jsonLd?.name && jsonLd.price) {
    return {
      name: jsonLd.name,
      brand: jsonLd.brand ?? 'Unknown',
      price: jsonLd.price,
      mrp: jsonLd.price,
      color: '',
      imageUrl: jsonLd.imageUrl ?? null,
      sizeChart: null,
    };
  }

  // Fallback: Myntra embeds a window.__myx state blob on some page variants.
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) return null;

  return {
    name: titleMatch[1].replace(/\s*\|\s*Myntra.*$/i, '').trim(),
    brand: 'Unknown',
    price: 0,
    mrp: 0,
    color: '',
    imageUrl: null,
    sizeChart: null,
  };
};
