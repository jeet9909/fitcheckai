// Outbound-link allowlist — defense against a compromised/buggy upstream
// response smuggling an arbitrary redirect/phishing URL into `productUrl`,
// which this function stores and the frontend later renders as a trusted
// "buy now" link. Any listing whose URL fails this check is dropped (logged
// + omitted) by the orchestrator before it's upserted or returned — it never
// reaches the client or the database.

import type { StoreListing } from './types.ts';

type Store = StoreListing['store'];

// Each entry is a bare hostname. A URL's hostname is allowed if it equals
// the entry exactly, or is a subdomain of it (i.e. ends with `.<entry>`).
const ALLOWED_HOSTS: Record<Store, string[]> = {
  Amazon: ['amazon.in', 'amzn.to'],
  Flipkart: ['flipkart.com', 'fkrt.it', 'dl.flipkart.com'],
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
