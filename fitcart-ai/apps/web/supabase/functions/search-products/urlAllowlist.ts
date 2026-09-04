// Trusted-domain allowlist for a store, used for two distinct purposes that
// share the same "is this really <store>'s own domain" question:
//   1. Outbound-link defense (the original/primary purpose) — a compromised
//      or buggy upstream response could smuggle an arbitrary redirect/
//      phishing URL into `productUrl`, which this function stores and the
//      frontend later renders as a trusted "buy now" link. Any listing whose
//      `productUrl` fails this check is dropped (logged + omitted) by the
//      orchestrator before it's upserted or returned — it never reaches the
//      client or the database.
//   2. Curated `imageUrls` validation (added for curate-product) — an <img>
//      tag auto-loads its src (no user click-through, so the phishing-link
//      risk above doesn't directly apply), but a curator-supplied gallery
//      URL still needs to actually belong to the product's own store rather
//      than an arbitrary domain, so the same allowlist is reused rather than
//      maintaining a second one.
//
// IMPORTANT, learned live 2026-09-04: a store's *page* domain and its *image
// CDN* domain are often genuinely different registered domains (Amazon's
// product pages are amazon.in, but its image CDN is media-amazon.com;
// Flipkart's are flipkart.com vs. flixcart.com) — this allowlist must carry
// both for a store, or real, legitimate image URLs fail validation. This was
// caught by a live end-to-end test of curate-product against a real
// Flipkart image URL, not by any prior review pass — the entries below were
// missing the CDN domains until that test failed. Meesho/Myntra/AJIO/Nykaa
// Fashion's real image CDN domains are not yet confirmed (their scraping has
// been blocked all session, so no real image_url has ever been observed for
// them) — add each only once actually observed live, never guessed.
import type { StoreListing } from './types.ts';

type Store = StoreListing['store'];

// Each entry is a bare hostname. A URL's hostname is allowed if it equals
// the entry exactly, or is a subdomain of it (i.e. ends with `.<entry>`).
const ALLOWED_HOSTS: Record<Store, string[]> = {
  // media-amazon.com: confirmed live 2026-09-04 as the host behind every
  // real Amazon image_url already in the catalog (e.g.
  // m.media-amazon.com/images/I/...). ssl-images-amazon.com: Amazon's other
  // observed image-CDN domain (seen on amazon.in's own page markup earlier
  // this session, e.g. images-eu.ssl-images-amazon.com) — added for the same
  // reason even though no persisted image_url has used it yet, since it's
  // an equally real, confirmed-observed Amazon-owned CDN domain, not a guess.
  Amazon: ['amazon.in', 'amzn.to', 'media-amazon.com', 'ssl-images-amazon.com'],
  // flixcart.com: confirmed live 2026-09-04 as the host behind every real
  // Flipkart image_url already in the catalog (rukmini1.flixcart.com).
  Flipkart: ['flipkart.com', 'fkrt.it', 'dl.flipkart.com', 'flixcart.com'],
  Meesho: ['meesho.com'],
  Myntra: ['myntra.com'],
  AJIO: ['ajio.com'],
  'Nykaa Fashion': ['nykaafashion.com'],
};

function hostMatches(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase();
  const suffix = allowed.toLowerCase();
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function isAllowedMarketplaceUrl(store: Store, url: string): boolean {
  const allowedHosts = ALLOWED_HOSTS[store];
  if (!allowedHosts) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  return allowedHosts.some((allowed) => hostMatches(parsed.hostname, allowed));
}
