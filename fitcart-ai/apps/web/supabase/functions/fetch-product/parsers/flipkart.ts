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

    // Best-effort probes at the same unstable state shape for the richer
    // fields — never verified against a real captured Flipkart product page
    // this session (unlike Amazon's regexes above, which were built and
    // tested against 7 real pages), so these are honest guesses at plausible
    // key paths, not a confirmed contract. Any path that doesn't resolve to
    // the right primitive type falls through to null/[] exactly like a page
    // that genuinely never carried the data — never a fabricated value.
    const descriptionRaw = state?.pageDataV4?.page?.data?.description
      ?? state?.PRODUCT_SUMMARY?.[0]?.productInfo?.description;
    const description = typeof descriptionRaw === 'string' && descriptionRaw.trim().length > 0
      ? descriptionRaw.trim()
      : null;

    const materialRaw = state?.pageDataV4?.page?.data?.specifications?.material;
    const material = typeof materialRaw === 'string' && materialRaw.trim().length > 0
      ? materialRaw.trim()
      : null;

    const rawImages = state?.pageDataV4?.page?.data?.media?.images
      ?? state?.PRODUCT_SUMMARY?.[0]?.media?.images;
    const imageUrls = Array.isArray(rawImages)
      ? rawImages
        .map((entry: unknown) => (typeof entry === 'string' ? entry : (entry as Record<string, unknown> | undefined)?.url))
        .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
      : [];

    return {
      name,
      brand: 'Unknown',
      price: Number(price),
      mrp: Number(price),
      color: '',
      sizeChart: null,
      description,
      material,
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
    };
  } catch {
    return null;
  }
};
