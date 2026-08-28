import type { Parser } from './types.ts';

// Before enabling in production: check https://www.amazon.in/robots.txt —
// Amazon disallows most crawler access to /dp/ and /gp/ paths for
// non-whitelisted bots, and its ToS restricts automated scraping. The
// Amazon Associates / Product Advertising API is the compliant path for
// production use; this plain-fetch parser is best-effort/demo-only and
// should be gated behind that decision before any real traffic hits it.
//
// Known limitation: Amazon serves heavy bot-detection and frequently blocks
// or CAPTCHAs non-browser fetches outright, so even the server-rendered
// HTML this function can see is unreliable. No attempt is made here to
// evade that detection (no UA spoofing, no CAPTCHA solving) — a null
// return is the expected common case.
export const parse: Parser = (html, _url) => {
  const nameMatch = html.match(/id="productTitle"[^>]*>([^<]+)</i);
  const priceMatch = html.match(/id="priceblock_ourprice"[^>]*>([^<]+)</i)
    ?? html.match(/class="a-price-whole"[^>]*>([^<]+)</i);

  if (!nameMatch) return null;

  const price = priceMatch ? Number(priceMatch[1].replace(/[^\d.]/g, '')) : 0;

  return {
    name: nameMatch[1].trim(),
    brand: 'Unknown',
    price,
    mrp: price,
    color: '',
    imageUrl: null,
    sizeChart: null,
  };
};
