// Search-results-page scraper for AJIO — used by the orchestrator only as a
// fallback when configured() is false, which for AJIO is permanent (see
// orchestrator.ts's PROVIDERS entry — there is no public AJIO catalog/
// search API to ever configure). See amazonSearchScraper.ts's header comment
// for why this is structurally different territory from fetch-product's
// single-product-URL scraper (fetch-product/parsers/ajio.ts).
//
// LIVE-TESTED 2026-09-02/03 against a real
// `https://www.ajio.com/search/?text=kurta` request:
//   - Confirmed this is the right URL/param shape — a real `200` response,
//     no redirect away from ajio.com.
//   - The page DOES include real JSON-LD: an `ItemList` block (`numberOfItems:
//     "66770"`) whose `itemListElement` entries each carry a real `name`,
//     `url`, and `image` — but NO `offers`/price field on any entry
//     (confirmed by inspecting the parsed block directly; same shape as
//     Myntra's search-page JSON-LD). Per D-014, an item without a real price
//     is dropped, not fabricated — so today this yields zero usable listings
//     despite the page loading successfully and JSON-LD being present.
//   - AJIO's own single-product parser (fetch-product/parsers/ajio.ts) notes
//     it's a heavily client-rendered React storefront; this search page's
//     `window.__PRELOADED_STATE__` blob almost certainly carries real
//     pricing, but per this task's scope this scraper is JSON-LD-only — no
//     state-blob reverse-engineering (see meeshoSearchScraper.ts's header
//     comment for the same reasoning).
// Conclusion: a real page loads reliably with real (if price-less) JSON-LD —
// the honest outcome is `blocked` (mapped to the orchestrator's
// `scrape_blocked`) with a reason that says exactly why, not a generic
// "couldn't parse" message.
//
// No UA rotation, no CAPTCHA-solving, no proxies, no state-blob parsing —
// same honesty boundary as the other scrapers here.

import { extractJsonLdBlocks } from '../../_shared/jsonld.ts';
import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText } from './htmlUtils.ts';

const SEARCH_URL_BASE = 'https://www.ajio.com/search/?text=';
const EXPECTED_HOST = 'ajio.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function brandFromJsonLd(brand: unknown): string {
  if (typeof brand === 'string') return brand;
  if (brand && typeof brand === 'object' && typeof (brand as Record<string, unknown>).name === 'string') {
    return (brand as Record<string, unknown>).name as string;
  }
  return 'Unknown';
}

function listingsFromJsonLd(blocks: unknown[]): ScrapedListing[] {
  const listings: ScrapedListing[] = [];

  for (const block of blocks) {
    const candidates = Array.isArray(block) ? block : [block];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const node = candidate as Record<string, unknown>;
      const type = Array.isArray(node['@type']) ? (node['@type'] as unknown[]).join(',') : String(node['@type'] ?? '');
      if (!/ItemList|Product/i.test(type)) continue;

      const elements = Array.isArray(node.itemListElement) ? (node.itemListElement as unknown[]) : [node];

      for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        const raw = el as Record<string, unknown>;
        const entry = (raw.item && typeof raw.item === 'object' ? raw.item : raw) as Record<string, unknown>;

        const name = typeof entry.name === 'string' ? entry.name : undefined;
        const productUrl = typeof entry.url === 'string' ? entry.url : undefined;
        const offers = (Array.isArray(entry.offers) ? entry.offers[0] : entry.offers) as Record<string, unknown> | undefined;
        const priceRaw = offers?.price;
        const price = typeof priceRaw === 'string' || typeof priceRaw === 'number' ? parseIndianPrice(String(priceRaw)) : null;

        // Never fabricate a price — confirmed live 2026-09-02/03: AJIO's
        // real ItemList JSON-LD entries carry name/url/image only, no
        // offers/price field at all, so this loop currently drops every
        // entry it sees. Kept general (not hardcoded to "always empty") in
        // case a future page revision adds pricing to this block.
        if (!name || !productUrl || price === null) continue;

        const image = entry.image;
        const imageUrl = typeof image === 'string' ? image : Array.isArray(image) && typeof image[0] === 'string' ? (image[0] as string) : null;

        listings.push({
          name,
          brand: brandFromJsonLd(entry.brand),
          price,
          mrp: price,
          color: '',
          imageUrl,
          productUrl,
          store: 'AJIO',
        });
      }
    }
  }

  return listings;
}

export async function scrapeAjioSearch(query: string): Promise<ScrapeOutcome> {
  const url = `${SEARCH_URL_BASE}${encodeURIComponent(query)}`;

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
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from AJIO` };
    }
    if (!isExpectedHost(res.url, EXPECTED_HOST)) {
      return { status: 'blocked', listings: [], reason: 'Response came from an unexpected host after redirect(s).' };
    }
    html = await readCappedText(res);
  } catch (err) {
    return { status: 'failed', listings: [], reason: capMessage(err) };
  }

  const listings = listingsFromJsonLd(extractJsonLdBlocks(html));

  if (listings.length === 0) {
    return {
      status: 'blocked',
      listings: [],
      reason: "AJIO returned a real page with JSON-LD ItemList entries, but none carried a real price (confirmed live: no offers/price field present) — nothing usable without fabricating a price.",
    };
  }

  return { status: 'success', listings };
}
