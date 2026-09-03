// Category-page ("browse node") scraper for Amazon — a different data
// source from amazonSearchScraper.ts's `/s?k=<query>` search-results page.
//
// LIVE-TESTED 2026-09-03 (see supabase/README.md for the full writeup):
// hitting `https://www.amazon.in/gp/browse.html?node=<id>` for a real
// category node returned a real 200 (not the WAF `x-amzn-waf-action:
// challenge` response that a bare `https://www.amazon.in` root request got
// in the same session) whose markup embeds a real, structured JSON payload
// via:
//
//   window.P.when('DiscountsWidgetsHorizonteAssets').execute(function (assets) {
//     assets.mountWidget('merchandised-search-<n>', { ...JSON... });
//   });
//
// That JSON's `productSearchResponse.products[]` array is a real "Deals in
// this category" widget — confirmed live for node 1968024031 ("Men's
// Clothing"), which returned real asin/title/price/image data (e.g.
// "Ray-Ban UV Protected Pilot Sunglasses for Men", asin B00TV7GZ52,
// priceToPay 5094.9 / basisPrice 6290.0).
//
// That was from a dev machine. Invoked live from the deployed Edge Function
// (via populate-catalog) the same day, the exact same node ID got a real
// `200` but with NO widget present at all — reported as 'blocked', not
// fabricated as empty success — while a dev-machine re-fetch of the same URL
// moments later still had it. Same "deployed function's egress treated more
// aggressively than a dev machine" pattern as amazonSearchScraper.ts and
// every other scraper in this directory — see supabase/README.md's
// "Amazon browse-node deals widget scraper" entry for the full writeup. Do
// not assume this reliably returns data in production.
//
// IMPORTANT — what this is NOT: this is Amazon's on-page "Deals" widget for
// the category, not the full category catalog, and not a query-driven
// search. It only returns whatever subset of that category currently has an
// active deal (confirmed: `symphonyConfig.filterInfo.promotionTypes` in the
// captured payload was `["TOP_DEAL","LIGHTNING_DEAL","BEST_DEAL"]`) — a
// category with no live deals may embed no widget at all, which this
// reports as `blocked` with an explicit reason, never fabricated as empty
// success. There is no known way to turn this into an arbitrary free-text
// search — see amazonSearchScraper.ts for that (separate, less reliable)
// path — so this scraper only ever takes a `nodeId`, never a `query`.
//
// Node IDs are NOT guessed. Every ID this scraper is actually called with
// (see ../../populate-catalog/amazonBrowseNodes.ts) must have been verified
// live before being added — see that file's header comment.
//
// Same honesty boundary as amazonSearchScraper.ts: no UA rotation, no
// CAPTCHA-solving, no proxies. A response that can't be turned into real
// listings is reported as 'blocked', never silently papered over with
// fabricated data (see DECISION_LOG.md D-014).

import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText } from './htmlUtils.ts';

const BROWSE_URL_BASE = 'https://www.amazon.in/gp/browse.html?node=';
const EXPECTED_HOST = 'amazon.in';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Matches `assets.mountWidget('merchandised-search-<digits>', ` — the
// widget's numeric suffix has been observed to vary (`merchandised-search-30`
// live 2026-09-03), so it's a wildcard, not a fixed string.
const WIDGET_CALL_RE = /assets\.mountWidget\('merchandised-search-\d+',\s*/;

// The widget's JSON argument is a real (large, deeply nested) JSON object
// literal, not a simple key: no regex can safely pull nested fields back out
// of it — a `"price"` (say) could just as easily appear inside a string
// value elsewhere in the blob. Instead this walks the text char-by-char from
// the opening `{`, tracking string/escape state so braces inside string
// values are never mistaken for structural ones, and returns the slice once
// the matching closing `}` is found. Returns null if no balanced object is
// found before the string ends (a truncated/malformed page).
function extractBalancedJsonObject(html: string, fromIndex: number): string | null {
  const start = html.indexOf('{', fromIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }

  return null;
}

interface DealsWidgetPrice {
  price?: string;
}

interface DealsWidgetImageVariant {
  baseUrl?: string;
  extension?: string;
}

interface DealsWidgetProduct {
  asin?: string;
  title?: string;
  link?: string;
  image?: {
    hiRes?: DealsWidgetImageVariant;
    lowRes?: DealsWidgetImageVariant;
  };
  price?: {
    priceToPay?: DealsWidgetPrice;
    basisPrice?: DealsWidgetPrice;
  };
  brandLogo?: {
    altText?: string;
  };
}

interface DealsWidgetPayload {
  productSearchResponse?: {
    products?: DealsWidgetProduct[];
  };
}

function imageUrlFrom(image: DealsWidgetProduct['image']): string | null {
  const variant = image?.hiRes ?? image?.lowRes;
  if (!variant?.baseUrl || !variant.extension) return null;
  return `${variant.baseUrl}.${variant.extension}`;
}

function listingsFromDealsWidget(payload: DealsWidgetPayload): ScrapedListing[] {
  const products = payload.productSearchResponse?.products;
  if (!Array.isArray(products)) return [];

  const listings: ScrapedListing[] = [];
  for (const product of products) {
    const name = product.title;
    const asin = product.asin;
    const link = product.link;
    if (!name || !asin || !link) continue;

    const priceRaw = product.price?.priceToPay?.price;
    const price = priceRaw ? parseIndianPrice(priceRaw) : null;
    if (price === null) continue; // never fabricate a missing price

    const mrpRaw = product.price?.basisPrice?.price;
    const mrp = mrpRaw ? parseIndianPrice(mrpRaw) : null;

    listings.push({
      name,
      brand: product.brandLogo?.altText ?? 'Unknown',
      price,
      mrp: mrp ?? price,
      color: '',
      imageUrl: imageUrlFrom(product.image),
      productUrl: link.startsWith('http') ? link : `https://www.amazon.in${link}`,
      store: 'Amazon',
    });
  }
  return listings;
}

export async function scrapeAmazonBrowseNode(nodeId: string): Promise<ScrapeOutcome> {
  const url = `${BROWSE_URL_BASE}${encodeURIComponent(nodeId)}`;

  let html: string;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    if (!res.ok) {
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from Amazon` };
    }
    // Same redirect-hijack defense as amazonSearchScraper.ts — see
    // htmlUtils.ts's isExpectedHost doc comment.
    if (!isExpectedHost(res.url, EXPECTED_HOST)) {
      return { status: 'blocked', listings: [], reason: 'Response came from an unexpected host after redirect(s).' };
    }
    html = await readCappedText(res);
  } catch (err) {
    return { status: 'failed', listings: [], reason: capMessage(err) };
  }

  const widgetMatch = WIDGET_CALL_RE.exec(html);
  if (!widgetMatch) {
    return {
      status: 'blocked',
      listings: [],
      reason: 'No deals widget found on this browse-node page (no active deals for this category right now, or Amazon changed the page markup).',
    };
  }

  const jsonText = extractBalancedJsonObject(html, widgetMatch.index + widgetMatch[0].length);
  if (!jsonText) {
    return { status: 'blocked', listings: [], reason: "Found the deals widget call but couldn't extract a balanced JSON object from it." };
  }

  let payload: DealsWidgetPayload;
  try {
    payload = JSON.parse(jsonText);
  } catch (err) {
    return { status: 'blocked', listings: [], reason: `Deals widget JSON failed to parse: ${capMessage(err)}` };
  }

  const listings = listingsFromDealsWidget(payload);
  if (listings.length === 0) {
    return { status: 'blocked', listings: [], reason: 'Deals widget was present but yielded no usable products (none had a title/asin/link/price together).' };
  }

  return { status: 'success', listings };
}
