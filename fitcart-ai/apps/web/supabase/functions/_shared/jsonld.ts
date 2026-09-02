// Generic, type-agnostic JSON-LD block extractor.
//
// Scans HTML for <script type="application/ld+json"> blocks and
// JSON.parse's each one, silently skipping any block that fails to parse —
// malformed/partial JSON-LD is common in the wild (trailing commas, HTML
// comments injected by a CMS, etc.) and should never abort the caller's
// larger parse over one bad script tag.
//
// Deliberately returns `unknown[]` rather than a typed shape: callers know
// what schema.org type(s) they're looking for (Product, ItemList, etc.) and
// are responsible for narrowing/validating the result themselves.
//
// This is a new, more generic sibling of `fetch-product/parsers/jsonld.ts`
// (which is hardcoded to extracting a single schema.org/Product shape for
// the single-product-URL paste flow) — that file is intentionally left
// untouched; this one exists for the newer search-results scrapers under
// `search-products/scraping/`, which need to inspect arbitrary JSON-LD
// shapes (ItemList, etc.), not just Product.
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // malformed JSON-LD block — skip it, try the next script tag
      continue;
    }
  }
  return blocks;
}
