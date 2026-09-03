// Curated list of Amazon browse-node IDs for the deals-widget ingestion
// path (see ../search-products/scraping/amazonBrowseNodeScraper.ts).
//
// Every entry here MUST have been confirmed live (a real 200 with a real
// parseable deals-widget payload) before being added — node IDs are never
// guessed. Guessing one would risk silently scraping the wrong category
// under a misleading `label`, which is exactly the kind of unverified claim
// this codebase's docs (DECISION_LOG.md D-014, supabase/README.md) are
// explicit about avoiding.
//
// Only one entry is verified as of 2026-09-03. Add more only after doing
// the same live check (fetch `https://www.amazon.in/gp/browse.html?node=<id>`
// yourself and confirm the `assets.mountWidget('merchandised-search-...'`
// payload is really for that category) — see amazonBrowseNodeScraper.ts's
// header comment for what a real response looks like.
export interface AmazonBrowseNode {
  id: string;
  label: string;
}

export const AMAZON_BROWSE_NODES: AmazonBrowseNode[] = [
  // Verified live 2026-09-03: real 200, real "Men's Clothing" deals widget
  // (e.g. asin B00TV7GZ52, "Ray-Ban UV Protected Pilot Sunglasses for Men").
  { id: '1968024031', label: "Men's Clothing" },
];
