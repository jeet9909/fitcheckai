// Client-side defense-in-depth allowlist for marketplace product links.
// The backend applies the equivalent check server-side before a listing is
// ever upserted — this exists so the UI never renders a clickable <a href>
// for a URL that didn't come from the expected marketplace domain, even if
// a future bug or a compromised response slipped one through.

export type MarketplaceStore = 'Amazon' | 'Flipkart' | 'Meesho' | 'Myntra' | 'AJIO' | 'Nykaa Fashion';

const ALLOWED_HOST_SUFFIXES: Record<MarketplaceStore, string[]> = {
  Amazon: ['.amazon.in', 'amzn.to'],
  Flipkart: ['.flipkart.com', 'fkrt.it', 'dl.flipkart.com'],
  Meesho: ['.meesho.com'],
  Myntra: ['.myntra.com'],
  AJIO: ['.ajio.com'],
  'Nykaa Fashion': ['.nykaafashion.com'],
};

function hostMatchesSuffix(host: string, suffix: string): boolean {
  // Exact match (covers bare domains like "amzn.to") or a proper subdomain
  // (host ends with ".suffix" when suffix itself doesn't already start with a dot).
  if (suffix.startsWith('.')) {
    return host === suffix.slice(1) || host.endsWith(suffix);
  }
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function isAllowedMarketplaceUrl(store: MarketplaceStore, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const host = parsed.hostname.toLowerCase();
  const suffixes = ALLOWED_HOST_SUFFIXES[store];
  return suffixes.some((suffix) => hostMatchesSuffix(host, suffix));
}
