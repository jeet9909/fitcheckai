export interface ParsedProduct {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  // A plain JSON object (never an array/primitive) or null — same loose,
  // per-category shape curate-product's own `sizeChart` field already
  // expects (see curate-product/index.ts's `isPlainObject` check and
  // updateProduct.ts's UpdateProductInput) and ProductDetail.tsx's
  // defensive renderer (`sizeChartEntries`) already handles. Tightened from
  // `unknown | null` to this shape so a parser can't accidentally hand
  // fetch-product/index.ts's enrichment wiring something that would fail
  // curate-product's own validation downstream.
  sizeChart: Record<string, unknown> | null;
  // Real prose extracted from the product's own page — HTML-stripped,
  // whitespace-normalized. `null` (never an empty string or fabricated
  // placeholder) when no description section was found.
  description: string | null;
  // Only set when the page states an explicit fabric/material value (e.g. a
  // "Fabric:"/"Material:" bullet) — many real product pages genuinely never
  // state this, and `null` is the honest, correct result for those, not a
  // bug to work around by inferring/guessing.
  material: string | null;
  // A real, deduped image gallery pulled from the page's own markup — empty
  // array (never null) when none were found, matching curate-product's own
  // `imageUrls` convention.
  imageUrls: string[];
}

export type Parser = (html: string, url: string) => ParsedProduct | null;
