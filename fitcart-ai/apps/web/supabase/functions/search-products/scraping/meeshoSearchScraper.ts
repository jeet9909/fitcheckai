// Search-results-page scraper for Meesho — used by the orchestrator only as
// a fallback when configured() is false, which for Meesho is permanent (see
// orchestrator.ts's PROVIDERS entry — there is no public Meesho catalog/
// search API to ever configure). See amazonSearchScraper.ts's header comment
// for why this is structurally different territory from fetch-product's
// single-product-URL scraper (fetch-product/parsers/meesho.ts).
//
// LIVE-TESTED 2026-09-02/03 against a real
// `https://www.meesho.com/search?q=kurta` request:
//   - Confirmed this is the right URL/param shape — a real `200` response,
//     ~47KB of HTML, no redirect away from meesho.com.
//   - Exactly one `<script type="application/ld+json">` block is present,
//     and it's a schema.org `Organization` block (site-wide contact/logo
//     metadata) — NOT an `ItemList`/`Product` block with any per-item data,
//     let alone a price. fetch-product/parsers/meesho.ts's own comment notes
//     Meesho's storefront is client-rendered; this search page is the same
//     story — a `__NEXT_DATA__` script tag is present (Next.js's own
//     hydration payload) and almost certainly carries the real product
//     grid, but per this task's scope this scraper does NOT reverse-engineer
//     that blob's shape — JSON-LD-only is the deliberate level of
//     investment here (see flipkartSearchScraper.ts's __INITIAL_STATE__
//     precedent for how much heavier a real state-blob parse is, and this
//     task's instruction to not repeat that investment speculatively for a
//     store where it hasn't been confirmed to pay off).
// Conclusion: a real page loads every time so far (no bot-block observed),
// but it carries no parseable product data via JSON-LD — expect
// `blocked` (mapped to the orchestrator's `scrape_blocked`) as the honest,
// permanent outcome for this scraper unless a future Meesho page revision
// starts emitting real Product/ItemList JSON-LD with prices.
//
// No UA rotation, no CAPTCHA-solving, no proxies, no state-blob parsing —
// same honesty boundary as the other scrapers here. A response that can't be
// turned into real listings is reported as 'blocked', never silently
// papered over with fabricated data (see DECISION_LOG.md D-014).

import { extractJsonLdBlocks } from '../../_shared/jsonld.ts';
import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText } from './htmlUtils.ts';

const SEARCH_URL_BASE = 'https://www.meesho.com/search?q=';
const EXPECTED_HOST = 'meesho.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function brandFromJsonLd(brand: unknown): string {
  if (typeof brand === 'string') return brand;
  if (brand && typeof brand === 'object' && typeof (brand as Record<string, unknown>).name === 'string') {
    return (brand as Record<string, unknown>).name as string;
  }
  return 'Unknown';
}

// Same shape-agnostic ItemList/Product walk as amazonSearchScraper.ts's
// listingsFromJsonLd — kept deliberately unshared (this repo's convention
// for these scrapers is one self-contained file per store, see
// flipkartSearchScraper.ts's similarly-duplicated JSON-LD walk).
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

        // Never fabricate a price — confirmed live 2026-09-02/03: Meesho's
        // only JSON-LD block on the search page is a site-wide Organization
        // entry, so in practice this loop currently has nothing to iterate
        // at all. Kept general (not hardcoded to "always empty") in case a
        // future page revision adds real Product/ItemList JSON-LD.
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
          store: 'Meesho',
        });
      }
    }
  }

  return listings;
}

export async function scrapeMeeshoSearch(query: string): Promise<ScrapeOutcome> {
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
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from Meesho` };
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
      reason: "Meesho returned a page with no parseable product data in JSON-LD (its search page is client-rendered via __NEXT_DATA__, which this scraper deliberately doesn't parse).",
    };
  }

  return { status: 'success', listings };
}
