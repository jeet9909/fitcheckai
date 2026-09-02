// Search-results-page scraper for Flipkart — used by the orchestrator only
// as a fallback when FLIPKART_AFFILIATE_* credentials aren't configured
// (see orchestrator.ts's runProvider). See amazonSearchScraper.ts's header
// comment for why this is new, structurally different territory from
// fetch-product's single-product-URL scraper.
//
// LIVE-TESTED 2026-09-02 against a real
// `https://www.flipkart.com/search?q=...` request, twice, with two
// different outcomes (see supabase/README.md for the full writeup):
//   1. A single isolated ad-hoc request got a real 200 that DID include one
//      JSON-LD block (`@type: "ItemList"`), but each `itemListElement` only
//      carried `name`/`url`/`position` — no `offers`/price, not enough to
//      build a real StoreListing (D-014 forbids fabricating one). The page
//      also embeds `window.__INITIAL_STATE__` (a large Redux-style state
//      blob), which DID carry a `PRODUCT_SUMMARY` widget with full
//      title/brand/price/MRP/image data for every tile — 40/40 products
//      had complete data. That blob is the effective data source once
//      JSON-LD alone doesn't yield a price for an item.
//   2. A live curl against the deployed Edge Function got no response at
//      all within 90+ seconds (consistent with an anti-bot tactic of
//      accepting the connection and never sending data, rather than an
//      outright rejection) — this is why every request here now goes
//      through `fetchWithTimeout` (see htmlUtils.ts) instead of a bare
//      `fetch`.
// Conclusion: the parsing logic below is real and does work against real
// markup, but Flipkart's bot detection (or the deployed function's egress
// network specifically) blocks/hangs quickly under repeated or automated-
// looking traffic — expect `blocked`/`failed` (mapped to the
// orchestrator's `scrape_blocked`/`scrape_failed`) as the common case in
// production, not the exception.
//
// JSON-LD is still tried first per-item — if a future response embeds a
// real price in an itemListElement, it's used directly rather than falling
// through to the heavier state-blob parse.
//
// No UA rotation, no CAPTCHA-solving, no proxies — same honesty boundary as
// fetch-product's scraper. A response that can't be turned into real
// listings is reported as 'blocked', never silently papered over.

import { extractJsonLdBlocks } from '../../_shared/jsonld.ts';
import type { ScrapeOutcome, ScrapedListing } from './types.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, parseIndianPrice, readCappedText } from './htmlUtils.ts';

const SEARCH_URL_BASE = 'https://www.flipkart.com/search?q=';
const EXPECTED_HOST = 'flipkart.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const INITIAL_STATE_MARKER = 'window.__INITIAL_STATE__';
// Defensive bound on the state-blob tree walk below — this JSON comes from
// an untrusted third-party response; a node budget keeps a pathological or
// adversarial payload from turning a single scrape into an unbounded scan.
const MAX_NODES_VISITED = 200_000;

function listingsFromJsonLd(blocks: unknown[]): ScrapedListing[] {
  const listings: ScrapedListing[] = [];

  for (const block of blocks) {
    const candidates = Array.isArray(block) ? block : [block];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const node = candidate as Record<string, unknown>;
      if (!/ItemList/i.test(String(node['@type'] ?? ''))) continue;

      const elements = Array.isArray(node.itemListElement) ? (node.itemListElement as unknown[]) : [];
      for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        const entry = el as Record<string, unknown>;

        const name = typeof entry.name === 'string' ? entry.name : undefined;
        const productUrl = typeof entry.url === 'string' ? entry.url : undefined;
        const offers = entry.offers as Record<string, unknown> | undefined;
        const priceRaw = offers?.price;
        const price = typeof priceRaw === 'string' || typeof priceRaw === 'number' ? parseIndianPrice(String(priceRaw)) : null;

        // Confirmed live 2026-09-02: Flipkart's ItemList JSON-LD carries no
        // price at all. We never fabricate one — an item without a real
        // price from this block simply isn't usable from JSON-LD alone,
        // and we fall through to the embedded __INITIAL_STATE__ blob.
        if (!name || !productUrl || price === null) continue;

        listings.push({
          name,
          brand: 'Unknown',
          price,
          mrp: price,
          color: '',
          imageUrl: typeof entry.image === 'string' ? entry.image : null,
          productUrl,
          store: 'Flipkart',
        });
      }
    }
  }

  return listings;
}

// Extracts and JSON.parses the `window.__INITIAL_STATE__ = {...};` blob
// embedded in a <script> tag. Returns null (never throws) on anything
// unexpected — an absent or malformed blob is treated as "nothing found
// here", same as zero JSON-LD blocks, not a hard error.
function extractInitialStateBlob(html: string): unknown | null {
  const markerIndex = html.indexOf(INITIAL_STATE_MARKER);
  if (markerIndex === -1) return null;

  const scriptEnd = html.indexOf('</script>', markerIndex);
  if (scriptEnd === -1) return null;

  const scriptContent = html.slice(markerIndex, scriptEnd);
  const eqIndex = scriptContent.indexOf('=');
  if (eqIndex === -1) return null;

  let jsonText = scriptContent.slice(eqIndex + 1).trim();
  if (jsonText.endsWith(';')) jsonText = jsonText.slice(0, -1);

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

// Iteratively (not recursively, to avoid a stack-depth risk on a large
// untrusted tree) walks the state blob looking for every node shaped like
// `{ type: 'PRODUCT_SUMMARY', data: {...} }` — Flipkart's search-results
// page renders each row of product tiles as one such widget.
function findProductSummaryWidgetData(root: unknown): unknown[] {
  const found: unknown[] = [];
  const stack: unknown[] = [root];
  let visited = 0;

  while (stack.length > 0 && visited < MAX_NODES_VISITED) {
    const node = stack.pop();
    visited++;
    if (!node || typeof node !== 'object') continue;

    if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
      continue;
    }

    const obj = node as Record<string, unknown>;
    if (obj.type === 'PRODUCT_SUMMARY' && obj.data && typeof obj.data === 'object') {
      found.push(obj.data);
    }
    for (const key of Object.keys(obj)) stack.push(obj[key]);
  }

  return found;
}

interface FlipkartPriceEntry {
  value?: number;
  strikeOff?: boolean;
}

interface FlipkartProductValue {
  baseUrl?: string;
  titles?: { title?: string; superTitle?: string };
  pricing?: { prices?: FlipkartPriceEntry[] };
  media?: { images?: { url?: string }[] };
}

// Substitutes Flipkart's `{@width}`/`{@height}`/`{@quality}` image-URL
// template placeholders (confirmed live 2026-09-02) with fixed values —
// there's no natural "real" size to prefer here since the listing UI picks
// its own size; 200x200 at quality 70 is a reasonable thumbnail default.
function finalizeFlipkartImageUrl(template: string): string {
  return template
    .replace('{@width}', '200')
    .replace('{@height}', '200')
    .replace('{@quality}', '70')
    .replace(/^http:/, 'https:');
}

function listingFromProductValue(value: FlipkartProductValue): ScrapedListing | null {
  const name = value.titles?.title;
  const baseUrl = value.baseUrl;
  if (!name || !baseUrl) return null;

  const prices = value.pricing?.prices ?? [];
  // Confirmed live 2026-09-02 across 40/40 sampled products: Flipkart's
  // `pricing.prices` array holds exactly two entries — one flagged
  // `strikeOff: true` (the original/MRP, shown struck through) and one
  // flagged `strikeOff: false` (the actual price charged). Falling back to
  // the first/only entry keeps this working for a product with just one
  // price (no discount).
  const saleEntry = prices.find((p) => p.strikeOff === false) ?? prices[0];
  const mrpEntry = prices.find((p) => p.strikeOff === true) ?? saleEntry;

  // Math.round() here matches the convention used everywhere else prices
  // land in this codebase (parseIndianPrice in htmlUtils.ts,
  // amazonPaapi.ts, flipkartAffiliate.ts) — products.price/mrp are
  // `integer not null` columns, and upsertListings sends a store's whole
  // batch in one .upsert() call, so a single fractional value here would
  // fail the entire batch, not just this one listing.
  const price = typeof saleEntry?.value === 'number' ? Math.round(saleEntry.value) : null;
  if (price === null) return null; // never fabricate a missing price

  const mrp = typeof mrpEntry?.value === 'number' ? Math.round(mrpEntry.value) : price;
  const imageTemplate = value.media?.images?.[0]?.url;
  const productUrl = baseUrl.startsWith('http') ? baseUrl : `https://www.flipkart.com${baseUrl}`;

  return {
    name,
    brand: value.titles?.superTitle ?? 'Unknown',
    price,
    mrp,
    color: '',
    imageUrl: imageTemplate ? finalizeFlipkartImageUrl(imageTemplate) : null,
    productUrl,
    store: 'Flipkart',
  };
}

function listingsFromInitialState(html: string): ScrapedListing[] {
  const state = extractInitialStateBlob(html);
  if (!state) return [];

  const widgets = findProductSummaryWidgetData(state);
  const listings: ScrapedListing[] = [];

  for (const widgetData of widgets) {
    const data = widgetData as { products?: { productInfo?: { value?: FlipkartProductValue } }[] };
    for (const product of data.products ?? []) {
      const value = product.productInfo?.value;
      if (!value) continue;
      const listing = listingFromProductValue(value);
      if (listing) listings.push(listing);
    }
  }

  return listings;
}

export async function scrapeFlipkartSearch(query: string): Promise<ScrapeOutcome> {
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
      return { status: 'blocked', listings: [], reason: `HTTP ${res.status} from Flipkart` };
    }
    // Defense against a hijacked/compromised redirect sending this request
    // to an attacker-controlled or internal host whose response would
    // otherwise be parsed and trusted as if it were a real Flipkart page —
    // see htmlUtils.ts's isExpectedHost doc comment.
    if (!isExpectedHost(res.url, EXPECTED_HOST)) {
      return { status: 'blocked', listings: [], reason: 'Response came from an unexpected host after redirect(s).' };
    }
    html = await readCappedText(res);
  } catch (err) {
    return { status: 'failed', listings: [], reason: capMessage(err) };
  }

  const jsonLdListings = listingsFromJsonLd(extractJsonLdBlocks(html));
  const listings = jsonLdListings.length > 0 ? jsonLdListings : listingsFromInitialState(html);

  if (listings.length === 0) {
    return {
      status: 'blocked',
      listings: [],
      reason: "Flipkart returned a page that couldn't be parsed as real results (likely a bot-check page).",
    };
  }

  return { status: 'success', listings };
}
