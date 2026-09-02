import { assert, assertEquals } from './_testUtils.ts';
import { isAllowedMarketplaceUrl } from './urlAllowlist.ts';

Deno.test('urlAllowlist: allows canonical Amazon domains', () => {
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://www.amazon.in/dp/B0EXAMPLE'), true);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in/dp/B0EXAMPLE'), true);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amzn.to/abc123'), true);
});

Deno.test('urlAllowlist: allows canonical Flipkart domains', () => {
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://www.flipkart.com/product/p/itm123'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://flipkart.com/product/p/itm123'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://fkrt.it/abc'), true);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://dl.flipkart.com/dl/abc'), true);
});

Deno.test('urlAllowlist: denies cross-store URLs', () => {
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://www.flipkart.com/product/p/itm123'), false);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://www.amazon.in/dp/B0EXAMPLE'), false);
});

Deno.test('urlAllowlist: denies lookalike/subdomain-spoofed hosts', () => {
  // Classic bypass attempt: "amazon.in" appears as a *label*, not as the
  // actual registrable-domain suffix — must be rejected.
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in.evil.com/dp/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://evilamazon.in/dp/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in.co/dp/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://flipkart.com.evil.net/p/x'), false);
  assertEquals(isAllowedMarketplaceUrl('Flipkart', 'https://notflipkart.com/p/x'), false);
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
});
