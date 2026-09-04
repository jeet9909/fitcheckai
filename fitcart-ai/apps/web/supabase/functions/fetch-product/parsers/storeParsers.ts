// Single shared store-dispatch table — extracted out of fetch-product/
// index.ts so enrich-catalog (a separate Edge Function that re-runs these
// same per-store parsers against already-catalogued products) can reuse the
// exact same host-pattern -> store -> parser mapping instead of
// re-declaring a second, potentially-drifting copy of it. Behavior is
// unchanged from when this table lived inline in fetch-product/index.ts.

import { parse as parseMyntra } from './myntra.ts';
import { parse as parseAjio } from './ajio.ts';
import { parse as parseAmazon } from './amazon.ts';
import { parse as parseFlipkart } from './flipkart.ts';
import { parse as parseMeesho } from './meesho.ts';
import { parse as parseNykaaFashion } from './nykaaFashion.ts';
import type { Parser } from './types.ts';

// Matches products.store's real values (see schema.sql) and
// search-products/types.ts's StoreListing['store'] / urlAllowlist.ts's
// Store union — every real scraper/API adapter and curator-facing function
// in this codebase already writes/expects exactly these six strings.
export type Store = 'Myntra' | 'AJIO' | 'Amazon' | 'Flipkart' | 'Meesho' | 'Nykaa Fashion';

export interface StoreParserEntry {
  match: RegExp;
  store: Store;
  parser: Parser;
}

export const STORE_PARSERS: StoreParserEntry[] = [
  { match: /myntra\.com/i, store: 'Myntra', parser: parseMyntra },
  { match: /ajio\.com/i, store: 'AJIO', parser: parseAjio },
  { match: /amazon\.in/i, store: 'Amazon', parser: parseAmazon },
  { match: /flipkart\.com/i, store: 'Flipkart', parser: parseFlipkart },
  { match: /meesho\.com/i, store: 'Meesho', parser: parseMeesho },
  { match: /nykaafashion\.com/i, store: 'Nykaa Fashion', parser: parseNykaaFashion },
];

// Used by fetch-product/index.ts's single-URL paste flow, where only the
// URL (not a trusted store label) is known up front.
export function findParserEntryForUrl(url: string): StoreParserEntry | undefined {
  return STORE_PARSERS.find((entry) => entry.match.test(url));
}

// Used by enrich-catalog, where the candidate product row's own `store`
// column is already a trusted, known value (it was written by this exact
// table when the row was first created) — no need to re-derive it from the
// URL's host.
export function findParserEntryForStore(store: string): StoreParserEntry | undefined {
  return STORE_PARSERS.find((entry) => entry.store === store);
}
