import { assert, assertEquals } from './_testUtils.ts';
import { isAllowedMarketplaceUrl } from './urlAllowlist.ts';

Deno.test('urlAllowlist: allows canonical Amazon domains', () => {
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://www.amazon.in/dp/B0EXAMPLE'), true);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in/dp/B0EXAMPLE'), true);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amzn.to/abc123'), true);
});

Deno.test('urlAllowlist: allows Amazon image-CDN domains (distinct registered domains from amazon.in, confirmed live 2026-09-04)', () => {
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://m.media-amazon.com/images/I/51KYvMSM-DL._AC_SL1500_.jpg'), true);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://media-amazon.com/images/I/x.jpg'), true);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://images-eu.ssl-images-amazon.com/images/I/x.jpg'), true);
});

Deno.test('urlAllowlist: allows canonical Flipkart domains', () => {
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://www.flipkart.com/product/p/itm123'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://flipkart.com/product/p/itm123'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://fkrt.it/abc'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://dl.flipkart.com/dl/abc'), true);
});

Deno.test('urlAllowlist: allows the Flipkart image-CDN domain (a distinct registered domain from flipkart.com, confirmed live 2026-09-04)', () => {
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://rukmini1.flixcart.com/image/832/832/xif0q/shirt/x.jpeg'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://flixcart.com/image/x.jpeg'), true);
});

Deno.test('urlAllowlist: the new image-CDN domains stay store-scoped, not cross-allowed', () => {
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://m.media-amazon.com/images/I/x.jpg'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://rukmini1.flixcart.com/image/x.jpeg'), false);
});

Deno.test('urlAllowlist: allows canonical Meesho/Myntra/AJIO/Nykaa Fashion domains', () => {
  assertEquals(isAllowedMarketplaceUrl('Meesho', 'https://www.meesho.com/product/some-kurta/p/abc123'), true);
  assertEquals(isAllowedMarketplaceUrl('Meesho', 'https://meesho.com/product/some-kurta/p/abc123'), true);
  assertEquals(isAllowedMarketplaceUrl('Myntra', 'https://www.myntra.com/kurtas/brand/some-kurta/12345/buy'), true);
  assertEquals(isAllowedMarketplaceUrl('Myntra', 'https://myntra.com/kurtas/brand/some-kurta/12345/buy'), true);
  assertEquals(isAllowedMarketplaceUrl('AJIO', 'https://www.ajio.com/some-kurta/p/443118917_green'), true);
  assertEquals(isAllowedMarketplaceUrl('AJIO', 'https://ajio.com/some-kurta/p/443118917_green'), true);
  assertEquals(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://www.nykaafashion.com/product/some-kurta/p/abc123'), true);
  assertEquals(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://nykaafashion.com/product/some-kurta/p/abc123'), true);
});

Deno.test('urlAllowlist: denies cross-store URLs', () => {
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://www.flipkart.com/product/p/itm123'), false);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://www.amazon.in/dp/B0EXAMPLE'), false);
  assertEquals(isAllowedMarketplaceUrl('Meesho', 'https://www.myntra.com/kurtas/brand/x/1/buy'), false);
  assertEquals(isAllowedMarketplaceUrl('Myntra', 'https://www.ajio.com/x/p/1'), false);
  assertEquals(isAllowedMarketplaceUrl('AJIO', 'https://www.nykaafashion.com/x/p/1'), false);
  assertEquals(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://www.meesho.com/x/p/1'), false);
});

Deno.test('urlAllowlist: denies lookalike/subdomain-spoofed hosts', () => {
  // Classic bypass attempt: "amazon.in" appears as a *label*, not as the
  // actual registrable-domain suffix — must be rejected.
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in.evil.com/dp/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://evilamazon.in/dp/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in.co/dp/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://flipkart.com.evil.net/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://notflipkart.com/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Meesho', 'https://meesho.com.evil.net/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Meesho', 'https://notmeesho.com/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Myntra', 'https://myntra.com.evil.net/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Myntra', 'https://notmyntra.com/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('AJIO', 'https://ajio.com.evil.net/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('AJIO', 'https://notajio.com/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://nykaafashion.com.evil.net/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://notnykaafashion.com/p/x'), false);
});

Deno.test('urlAllowlist: denies malformed URLs and non-http(s) protocols', () => {
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'not-a-url'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', ''), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'javascript:alert(1)'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'ftp://amazon.in/x'), false);
});

Deno.test('urlAllowlist: mock example.com URLs are rejected by the allowlist itself', () => {
  // The allowlist has no knowledge of mock mode — it's the orchestrator's
  // job to skip this check for mock listings. Verifying the allowlist
  // itself still rejects example.com guards against someone loosening it
  // to "fix" mock mode instead of exempting mock listings upstream.
  assert(!isAllowedMarketplaceUrl('Amazon', 'https://example.com/mock-listing/amazon/amazon-1'));
  assert(!isAllowedMarketplaceUrl('Flipkart', 'https://example.com/mock-listing/flipkart/flipkart-1'));
  assert(!isAllowedMarketplaceUrl('Meesho', 'https://example.com/mock-listing/meesho/meesho-1'));
  assert(!isAllowedMarketplaceUrl('Myntra', 'https://example.com/mock-listing/myntra/myntra-1'));
  assert(!isAllowedMarketplaceUrl('AJIO', 'https://example.com/mock-listing/ajio/ajio-1'));
  assert(!isAllowedMarketplaceUrl('Nykaa Fashion', 'https://example.com/mock-listing/nykaa-fashion/nykaafashion-1'));
});
