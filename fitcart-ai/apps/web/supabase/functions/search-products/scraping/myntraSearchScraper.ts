// Search-results-page scraper for Myntra — used by the orchestrator only as
// a fallback when configured() is false, which for Myntra is permanent (see
// orchestrator.ts's PROVIDERS entry — there is no public Myntra catalog/
// search API to ever configure). See amazonSearchScraper.ts's header comment
// for why this is structurally different territory from fetch-product's
// single-product-URL scraper (fetch-product/parsers/myntra.ts, which fails
// at the HTTP/2 protocol level per supabase/README.md's 2026-09-01 findings
// — notably different from what's observed here against the *search* page).
//
// LIVE-TESTED 2026-09-02/03 against real Myntra URLs:
//   - Both `https://www.myntra.com/<query>` (path-style) and
//     `https://www.myntra.com/search?q=<query>` returned a real `200` (no
//     HTTP/2 reset like fetch-product's single-product-page scraper hit) —
//     `?q=` is used here since it's the more general form (a path segment
//     doesn't cleanly encode a multi-word query the same way a query
//     product-page category route does).
//   - The page DOES include real JSON-LD: an `ItemList` block with 10 real
//     `itemListElement` entries, each carrying a real `name` and `url` — but
//     NO `offers`/price field on any entry (confirmed by inspecting the
//     parsed block directly). Per D-014, an item without a real price is
//     dropped, not fabricated — so today this yields zero usable listings
//     despite the page loading successfully and JSON-LD being present.
//   - The page also embeds further hydration data, but per this task's
//     scope this scraper is JSON-LD-only — no state-blob reverse-
//     engineering (see meeshoSearchScraper.ts's header comment for the same
//     reasoning).
// Conclusion: unlike fetch-product's Myntra parser (blocked at the protocol
// level), this search-results scraper reliably gets a real response with
// real JSON-LD — but that JSON-LD carries no pricing today, so the honest
// outcome is `blocked` (mapped to the orchestrator's `scrape_blocked`) with
// a reason that says exactly that, not a generic "couldn't parse" message.
//
// No UA rotation, no CAPTCHA-solving, no proxies, no state-blob parsing —
// same honesty boundary as the other scrapers here.

import { extractJsonLdBlocks } from '../../_shared/jsonld.ts';
import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText } from './htmlUtils.ts';

const SEARCH_URL_BASE = 'https://www.myntra.com/search?q=';
const EXPECTED_HOST = 'myntra.com';
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

        // Never fabricate a price — confirmed live 2026-09-02/03: Myntra's
        // real ItemList JSON-LD entries carry name/url/position only, no
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
          store: 'Myntra',
        });
      }
    }
  }

  return listings;
}

export async function scrapeMyntraSearch(query: string): Promise<ScrapeOutcome> {
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
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from Myntra` };
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
      reason: "Myntra returned a real page with JSON-LD ItemList entries, but none carried a real price (confirmed live: no offers/price field present) — nothing usable without fabricating a price.",
    };
  }

  return { status: 'success', listings };
}
