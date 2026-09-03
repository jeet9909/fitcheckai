// Search-results-page scraper for Nykaa Fashion — used by the orchestrator
// only as a fallback when configured() is false, which for Nykaa Fashion is
// permanent (see orchestrator.ts's PROVIDERS entry — there is no public
// Nykaa Fashion catalog/search API to ever configure). See
// amazonSearchScraper.ts's header comment for why this is structurally
// different territory from fetch-product's single-product-URL scraper
// (fetch-product/parsers/nykaaFashion.ts).
//
// LIVE-TESTED 2026-09-02/03 against a real
// `https://www.nykaafashion.com/search?q=kurta` request, twice (once
// initially, once retried to rule out a transient blip):
//   - Both attempts got a real `502 Bad Gateway` (nginx) — not a 403/anti-
//     bot page like fetch-product's single-product-page finding for this
//     store, but still a non-2xx response with no HTML page content to even
//     attempt JSON-LD extraction on (671 bytes of nginx's own error page,
//     no `<script type="application/ld+json">` anywhere in it).
//   - `?q=` was still confirmed as *a* real routable param — a browser-side
//     JS redirect/rewrite likely exists for real traffic, but this scraper
//     (deliberately, like the others here) doesn't follow client-side
//     redirects or execute JS, so it only ever sees what the origin/edge
//     serves a plain `fetch()`.
// Conclusion: unlike Meesho/Myntra/AJIO (which all return real 200 pages,
// just without usable price data), Nykaa Fashion's search endpoint currently
// fails outright at the HTTP layer — the honest outcome is `blocked`
// (mapped to the orchestrator's `scrape_blocked`) with the real HTTP status
// in the reason, exactly like amazonSearchScraper.ts's HTTP-status branch.
// JSON-LD extraction code is still included below (matching this task's
// required shape and so a future non-502 response is handled for real, not
// just assumed to keep failing) but has not been exercised against a
// successful response.
//
// No UA rotation, no CAPTCHA-solving, no proxies, no state-blob parsing —
// same honesty boundary as the other scrapers here.

import { extractJsonLdBlocks } from '../../_shared/jsonld.ts';
import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText } from './htmlUtils.ts';

const SEARCH_URL_BASE = 'https://www.nykaafashion.com/search?q=';
const EXPECTED_HOST = 'nykaafashion.com';
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

        // Never fabricate a price — untested against a real successful
        // response (every live attempt so far got a 502 before any HTML was
        // available to parse; see the file header). Kept general rather
        // than stubbed out in case a future response is a real 200.
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
          store: 'Nykaa Fashion',
        });
      }
    }
  }

  return listings;
}

export async function scrapeNykaaFashionSearch(query: string): Promise<ScrapeOutcome> {
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
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from Nykaa Fashion` };
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
      reason: "Nykaa Fashion returned a page that couldn't be parsed as real results (likely a bot-check page).",
    };
  }

  return { status: 'success', listings };
}
