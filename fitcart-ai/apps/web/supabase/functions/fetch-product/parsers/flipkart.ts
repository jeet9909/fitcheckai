import type { Parser } from './types.ts';

// Before enabling in production: check https://www.flipkart.com/robots.txt —
// Flipkart's robots.txt historically disallows most automated access
// broadly ("Disallow: /"), which would make server-side fetching of
// product pages non-compliant. Verify current terms before enabling this
// parser against real traffic; the Flipkart Affiliate API is the
// compliant path for production use.
//
// Known limitation: like the other React-heavy storefronts here, price and
// size chart are client-rendered. This looks for a window.__INITIAL_STATE__
// (or similar) JSON blob if the server-rendered shell includes one; returns
// null when it doesn't.
export const parse: Parser = (html, _url) => {
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (!stateMatch) return null;

  try {
    const state = JSON.parse(stateMatch[1]);
    // Flipkart's state shape varies by page template and changes often —
    // this is a best-effort probe, not a stable contract.
    const name = state?.pageDataV4?.page?.data?.title
      ?? state?.PRODUCT_SUMMARY?.[0]?.titles?.title;
    const price = state?.pageDataV4?.page?.data?.pricing?.finalPrice?.value
      ?? state?.PRICES?.[0]?.pricing?.finalPrice?.value;

    if (!name || !price) return null;

    return {
      name,
      brand: 'Unknown',
      price: Number(price),
      mrp: Number(price),
      color: '',
      imageUrl: null,
      sizeChart: null,
    };
  } catch {
    return null;
  }
};
