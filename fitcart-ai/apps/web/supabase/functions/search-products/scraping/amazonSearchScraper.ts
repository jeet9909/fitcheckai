// Search-results-page scraper for Amazon — used by the orchestrator only as
// a fallback when AMAZON_CREATORS_* credentials aren't configured (see
// orchestrator.ts's runProvider). This is new, structurally different
// territory from fetch-product's single-product-URL scraper (see
// supabase/README.md's "Known limitations" section for that flow's
// documented findings): this hits a *search* results page and tries to
// parse many items out of it in one response, not a single product page.
//
// LIVE-TESTED 2026-09-02 against a real `https://www.amazon.in/s?k=...`
// request, twice, with two different outcomes (see supabase/README.md for
// the full writeup):
//   1. A single isolated ad-hoc request got a real 200 with no JSON-LD
//      blocks, but real, reliably parseable `data-component-type=
//      "s-search-result"` tile markup — 60/60 tiles yielded a title, price,
//      image, and ASIN via the HTML fallback below.
//   2. A handful of subsequent requests from the same IP, and separately a
//      live curl against the deployed Edge Function, both got a real `503`
//      whose body IS Amazon's own documented anti-automation page
//      ("automated access... contact api-services-support@amazon.com").
// Conclusion: the parsing logic below is real and does work against real
// markup, but Amazon's bot detection kicks in quickly under any repeated or
// automated-looking traffic — expect `blocked` (mapped to the orchestrator's
// `scrape_blocked`) as the common case in production, not the exception.
//
// JSON-LD is still tried first — Amazon has been observed to change search-
// page markup without notice, and a future response embedding
// schema.org/ItemList or Product data should be preferred over the more
// brittle HTML-tile regex fallback when available.
//
// No UA rotation, no CAPTCHA-solving, no proxies — same honesty boundary as
// fetch-product's scraper. A response that can't be turned into real
// listings is reported as 'blocked', never silently papered over with
// fabricated data (see DECISION_LOG.md D-014).

import { extractJsonLdBlocks } from '../../_shared/jsonld.ts';
import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText, textFromHtml, upsizeAmazonImageUrl } from './htmlUtils.ts';

const SEARCH_URL_BASE = 'https://www.amazon.in/s?k=';
const EXPECTED_HOST = 'amazon.in';
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
        // ItemList entries are sometimes { item: {...} }, sometimes the
        // Product itself directly — handle both shapes.
        const raw = el as Record<string, unknown>;
        const entry = (raw.item && typeof raw.item === 'object' ? raw.item : raw) as Record<string, unknown>;

        const name = typeof entry.name === 'string' ? entry.name : undefined;
        const productUrl = typeof entry.url === 'string' ? entry.url : undefined;
        const offers = (Array.isArray(entry.offers) ? entry.offers[0] : entry.offers) as Record<string, unknown> | undefined;
        const priceRaw = offers?.price;
        const price = typeof priceRaw === 'string' || typeof priceRaw === 'number' ? parseIndianPrice(String(priceRaw)) : null;

        // Never fabricate a price — an item without one from this block
        // simply isn't usable from JSON-LD alone.
        if (!name || !productUrl || price === null) continue;

        const image = entry.image;
        const rawImageUrl = typeof image === 'string' ? image : Array.isArray(image) && typeof image[0] === 'string' ? (image[0] as string) : null;
        const imageUrl = rawImageUrl ? upsizeAmazonImageUrl(rawImageUrl) : null;

        listings.push({
          name,
          brand: brandFromJsonLd(entry.brand),
          price,
          mrp: price,
          color: '',
          imageUrl,
          productUrl,
          store: 'Amazon',
        });
      }
    }
  }

  return listings;
}

// Amazon's search-result tiles: each result is a
//   <div ... data-asin="B0XXXXXXXX" ... data-component-type="s-search-result" ...>
// container. We split on that opening tag rather than attempting to
// HTML-parse nested divs with regex — we only need the ASIN out of the
// tile's own opening tag, plus a slice of the tile body up to the next
// tile's opening tag, not a full DOM tree.
const TILE_OPEN_RE = /<div[^>]*data-component-type="s-search-result"[^>]*>/g;
const ASIN_RE = /data-asin="([A-Z0-9]+)"/;
const H2_RE = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
const PRICE_RE = /class="a-price"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/;
const MRP_RE = /class="a-price a-text-price"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/;
const IMAGE_RE = /<img class="s-image"[^>]*src="([^"]+)"/;

function listingsFromTileHtml(html: string): ScrapedListing[] {
  const openTags = [...html.matchAll(TILE_OPEN_RE)];
  const listings: ScrapedListing[] = [];

  for (let i = 0; i < openTags.length; i++) {
    const start = openTags[i].index ?? 0;
    const end = i + 1 < openTags.length ? (openTags[i + 1].index ?? html.length) : html.length;
    const tileOpenTag = openTags[i][0];
    const tile = html.slice(start, end);

    const asin = ASIN_RE.exec(tileOpenTag)?.[1];
    if (!asin) continue;

    // A tile with a brand-logo link alongside the real title emits two
    // <h2> blocks: a short brand-only one and the full descriptive product
    // title. The real title is reliably the longer of the two (brand names
    // are short; product titles are long and descriptive) — confirmed
    // against real live tiles 2026-09-02 (e.g. "Zilcon" vs. "Men's Solid
    // Coffee Brown Casual Cotton Blend Shirt" in the same tile).
    const h2Texts = [...tile.matchAll(H2_RE)].map((m) => textFromHtml(m[1])).filter(Boolean);
    const name = h2Texts.sort((a, b) => b.length - a.length)[0];
    if (!name) continue;

    const priceText = PRICE_RE.exec(tile)?.[1];
    const price = priceText ? parseIndianPrice(priceText) : null;
    if (price === null) continue; // never fabricate a missing price

    const mrpText = MRP_RE.exec(tile)?.[1];
    const mrp = mrpText ? parseIndianPrice(mrpText) : null;

    const rawImageUrl = IMAGE_RE.exec(tile)?.[1] ?? null;
    const imageUrl = rawImageUrl ? upsizeAmazonImageUrl(rawImageUrl) : null;

    listings.push({
      name,
      // Brand isn't reliably present as a separate field per-tile in
      // search-result markup (unlike the Creators API's byLineInfo.brand) —
      // 'Unknown' here mirrors the same honest fallback amazonPaapi.ts /
      // flipkartAffiliate.ts already use when a real API response omits it.
      brand: 'Unknown',
      price,
      mrp: mrp ?? price,
      color: '',
      imageUrl,
      productUrl: `https://www.amazon.in/dp/${asin}`,
      store: 'Amazon',
    });
  }

  return listings;
}

export async function scrapeAmazonSearch(query: string): Promise<ScrapeOutcome> {
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
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from Amazon` };
    }
    // Defense against a hijacked/compromised redirect sending this request
    // to an attacker-controlled or internal host whose response would
    // otherwise be parsed and trusted as if it were a real Amazon page —
    // see htmlUtils.ts's isExpectedHost doc comment.
    if (!isExpectedHost(res.url, EXPECTED_HOST)) {
      return { status: 'blocked', listings: [], reason: 'Response came from an unexpected host after redirect(s).' };
    }
    html = await readCappedText(res);
  } catch (err) {
    return { status: 'failed', listings: [], reason: capMessage(err) };
  }

  const jsonLdListings = listingsFromJsonLd(extractJsonLdBlocks(html));
  const listings = jsonLdListings.length > 0 ? jsonLdListings : listingsFromTileHtml(html);

  if (listings.length === 0) {
    return {
      status: 'blocked',
      listings: [],
      reason: "Amazon returned a page that couldn't be parsed as real results (likely a bot-check page).",
    };
  }

  return { status: 'success', listings };
}
