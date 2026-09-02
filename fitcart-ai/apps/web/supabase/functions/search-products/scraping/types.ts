// Shared types for the scraping fallback (search-results-page scraping,
// used only when a store's real API isn't configured — see
// amazonSearchScraper.ts / flipkartSearchScraper.ts and orchestrator.ts).

import type { StoreListing } from '../types.ts';

// A scraped listing is a StoreListing minus `source` — the orchestrator (not
// the scraper) stamps `source: 'scraped'` once a listing has survived the
// same allowlist check every other listing goes through, mirroring how
// `source: 'live'` is applied to real-API results.
export type ScrapedListing = Omit<StoreListing, 'source'>;

export interface ScrapeOutcome {
  // 'success'  — at least one real listing was extracted from a real page.
  // 'blocked'  — the page loaded but couldn't be parsed as real results
  //              (non-2xx response, or 200 with nothing extractable —
  //              almost always a bot-check/placeholder page), or no
  //              listings survived the outbound-link allowlist.
  // 'failed'   — a thrown/network-level error (DNS, timeout, TLS, etc.).
  status: 'success' | 'blocked' | 'failed';
  listings: ScrapedListing[];
  reason?: string;
}
