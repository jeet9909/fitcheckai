import type { Parser } from './types.ts';
import { textFromHtml } from '../../search-products/scraping/htmlUtils.ts';

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
//
// Gallery/size-chart/description/material extraction below was built and
// tested this session against real Amazon product-page HTML (fetched
// manually via curl + a browser User-Agent, 7 real listings) — see the
// per-field comments for exactly what real markup each regex targets.
// Every extractor here follows the same honesty rule as the rest of this
// codebase: a shape it isn't confident about returns null/[] rather than a
// garbled partial result.

// Same cap curate-product's own MAX_IMAGE_URLS uses (curate-product/
// index.ts) — kept as a local constant rather than importing across
// function directories (each Supabase Edge Function is deployed as its own
// isolated bundle), chosen to match for consistency: a gallery this parser
// hands to fetch-product/index.ts's updateProduct() call must never exceed
// what curate-product would itself accept.
const MAX_GALLERY_IMAGES = 10;

// Real Amazon product pages embed a per-color image manifest as a JS/JSON
// object literal (e.g. inside a `colorImages`/`imageGalleryData` blob) with
// repeated `"hiRes":"https://...jpg"` entries — one of the most reliable,
// already-full-resolution (no upsizing needed, unlike search-tile
// thumbnails) signals on the page. Captures whatever sits between the
// quotes rather than hard-coding an escaped-vs-unescaped-slash assumption
// (both forms have been observed), and validates/normalizes afterward.
const HI_RES_RE = /"hiRes":"([^"]+)"/gi;
const IMAGE_EXTENSION_RE = /\.(?:jpe?g|png|webp)(?:[?#]|$)/i;

function extractGalleryImages(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(HI_RES_RE)) {
    const raw = match[1].replace(/\\\//g, '/').trim();
    if (!/^https?:\/\//i.test(raw)) continue;
    if (!IMAGE_EXTENSION_RE.test(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    urls.push(raw);
    if (urls.length >= MAX_GALLERY_IMAGES) break;
  }

  return urls;
}

// Keys that must never be written as a plain object's own property via
// naive assignment (`obj[key] = value`) — `"__proto__"` in particular would
// silently mutate the object's prototype rather than create an own
// property. Every object this file builds from parsed table text goes
// through Object.fromEntries (which is safe against this — it uses
// CreateDataPropertyOrThrow internally, not a `[key]=` assignment) after
// filtering these out, so a hostile/pathological size-chart table cell
// (e.g. literally containing the text "__proto__") can never pollute the
// resulting object's prototype.
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const CELL_RE = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
function parseRowCells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(CELL_RE)].map((m) => textFromHtml(m[1]));
}

// Amazon's real size-guide modal is referenced from a
// `data-a-modal="{&quot;name&quot;:&quot;sizeGuide&quot;...}"` attribute
// elsewhere on the page; the modal's own markup (found after that marker)
// contains a real Brand Size / IN Size / Waist (in) / Length (in) - style
// `<table>`. This locates that marker, then the first `<table>` after it,
// and turns it into `{ <first-column value, e.g. a size label>: {
// <other column header>: <cell value>, ... }, ... }` — one entry per
// non-header row, keyed by that row's own first cell (the size label),
// which is the most natural real-world key for "which row is this" and
// renders sensibly through ProductDetail.tsx's existing defensive
// `sizeChartEntries`/`formatSizeChartValue` (Object.entries + a
// JSON.stringify fallback for non-primitive values). If the table can't be
// found, or doesn't have at least a header row + one data row with at least
// two real columns, this returns null rather than a garbled/partial chart —
// same honesty standard as everything else in this file.
// How far past the sizeGuide marker to look for its modal's own `<table>` —
// bounded (rather than searching the rest of the whole page) so an
// unrelated `<table>` elsewhere on a long real page (e.g. a "product
// overview"/specs table) can never be mistaken for the size-guide table
// just because it happens to appear later in the same response.
const SIZE_CHART_SEARCH_WINDOW = 4000;

function extractSizeChart(html: string): Record<string, unknown> | null {
  const markerIdx = html.indexOf('&quot;sizeGuide&quot;');
  if (markerIdx === -1) return null;

  const after = html.slice(markerIdx, markerIdx + SIZE_CHART_SEARCH_WINDOW);
  const tableMatch = after.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const rowsHtml = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  if (rowsHtml.length < 2) return null;

  const headerCells = parseRowCells(rowsHtml[0]);
  if (headerCells.length < 2) return null;

  const chartEntries: [string, Record<string, unknown>][] = [];
  for (const rowHtml of rowsHtml.slice(1)) {
    const cells = parseRowCells(rowHtml);
    if (cells.length === 0) continue;

    const sizeLabel = cells[0]?.trim();
    if (!sizeLabel || FORBIDDEN_OBJECT_KEYS.has(sizeLabel)) continue;

    const measurementEntries: [string, string][] = [];
    for (let i = 1; i < cells.length && i < headerCells.length; i++) {
      const key = headerCells[i]?.trim();
      const value = cells[i]?.trim();
      if (!key || !value || FORBIDDEN_OBJECT_KEYS.has(key)) continue;
      measurementEntries.push([key, value]);
    }
    if (measurementEntries.length === 0) continue;

    chartEntries.push([sizeLabel, Object.fromEntries(measurementEntries)]);
  }

  if (chartEntries.length === 0) return null;
  return Object.fromEntries(chartEntries);
}

// Upper bound on how much text this ever returns — a real Amazon
// description is a few paragraphs; this is a generous cap against a
// malformed page where the "next section boundary" heuristic below fails to
// find a nearby boundary and would otherwise capture a huge slice of the
// rest of the page. Comfortably under curate-product's own 5000-character
// MAX_DESCRIPTION_LENGTH, so a real extracted description is never itself
// the reason a later curate-product-style write would be rejected.
const MAX_DESCRIPTION_LENGTH = 3000;
// How far to look for a natural section boundary before giving up and just
// capping the raw slice length instead.
const DESCRIPTION_SEARCH_WINDOW = 6000;
const DESCRIPTION_BOUNDARY_RE = /<h[1-4][\s>]|id="important-information"|id="productDetails|[Aa]dditional [Ii]nformation|id="detailBullets/;

// Real pages have the literal text "Product description" as a section
// heading, near the feature-bullets block, followed by real prose (often
// inside a `<div id="productDescription">` or similar). Takes everything
// from just after that heading up to the next recognizable section
// boundary (another heading, or a handful of known following-section
// markers observed on real pages), strips HTML, and collapses whitespace.
function extractDescription(html: string): string | null {
  const idx = html.indexOf('Product description');
  if (idx === -1) return null;

  const after = html.slice(idx + 'Product description'.length, idx + 'Product description'.length + DESCRIPTION_SEARCH_WINDOW);
  const boundaryMatch = after.match(DESCRIPTION_BOUNDARY_RE);
  const chunk = boundaryMatch && typeof boundaryMatch.index === 'number' ? after.slice(0, boundaryMatch.index) : after;

  const text = textFromHtml(chunk).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  return text.slice(0, MAX_DESCRIPTION_LENGTH);
}

const MAX_MATERIAL_LENGTH = 200;
// Only matches an *explicit* "Fabric:"/"Material:" (optionally "Material
// Type:") label followed by a real value — either the common bullet
// structure of two adjacent `<span>`s (label, then value) or plain
// inline text. Deliberately does not try to infer a material from the
// title or any other implicit signal — confirmed this session that roughly
// 2 of 7 real Amazon listings simply never state a material anywhere on the
// page, and `null` is the correct, honest result for those, not a bug.
// A real "product overview" table row wraps the label and value in separate
// `<span>`s inside sibling `<td>`s (e.g. `<td><span ...>Fabric type</span>
// </td><td><span ...>Cotton Blend</span></td>`), not two adjacent spans —
// the bounded `[\s\S]{0,120}?` gap tolerates that real structure (closing
// the label's own tag, td/tr boundaries) without letting the match wander
// arbitrarily far into an unrelated part of the page.
const MATERIAL_SPAN_RE = /(?:Fabric|Material)(?:\s*Type)?\s*:?\s*<\/span>[\s\S]{0,120}?<span[^>]*>\s*([^<]+?)\s*<\/span>/i;
const MATERIAL_INLINE_RE = /(?:Fabric|Material)(?:\s*Type)?\s*:\s*([^<\n]{1,100})/i;

function extractMaterial(html: string): string | null {
  const match = html.match(MATERIAL_SPAN_RE) ?? html.match(MATERIAL_INLINE_RE);
  if (!match) return null;

  const text = textFromHtml(match[1]).trim();
  if (!text) return null;

  return text.slice(0, MAX_MATERIAL_LENGTH);
}

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
    sizeChart: extractSizeChart(html),
    description: extractDescription(html),
    material: extractMaterial(html),
    imageUrls: extractGalleryImages(html),
  };
};
