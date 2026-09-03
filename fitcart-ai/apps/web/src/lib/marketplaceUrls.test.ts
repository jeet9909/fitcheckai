import { describe, expect, it } from 'vitest';
import { isAllowedMarketplaceUrl } from './marketplaceUrls';

describe('isAllowedMarketplaceUrl', () => {
  it('allows amazon.in product URLs', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://www.amazon.in/dp/B0ABCDEFG')).toBe(true);
  });

  it('allows bare amazon.in without subdomain', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in/dp/B0ABCDEFG')).toBe(true);
  });

  it('allows amzn.to short links for Amazon', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://amzn.to/3xyzABC')).toBe(true);
  });

  it('rejects a non-Amazon domain for the Amazon store', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://www.amazon.com/dp/B0ABCDEFG')).toBe(false);
  });

  it('rejects a lookalike domain that merely contains "amazon.in"', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://amazon.in.evil.com/dp/B0ABCDEFG')).toBe(false);
  });

  it('rejects a spoofed hostname prefix like "notamazon.in"', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://notamazon.in/dp/B0ABCDEFG')).toBe(false);
  });

  it('allows flipkart.com product URLs', () => {
    expect(isAllowedMarketplaceUrl('Flipkart', 'https://www.flipkart.com/product/p/itm123')).toBe(true);
  });

  it('allows bare flipkart.com without subdomain', () => {
    expect(isAllowedMarketplaceUrl('Flipkart', 'https://flipkart.com/product/p/itm123')).toBe(true);
  });

  it('allows fkrt.it short links for Flipkart', () => {
    expect(isAllowedMarketplaceUrl('Flipkart', 'https://fkrt.it/abc123')).toBe(true);
  });

  it('allows dl.flipkart.com deep links', () => {
    expect(isAllowedMarketplaceUrl('Flipkart', 'https://dl.flipkart.com/dl/product/p/itm123')).toBe(true);
  });

  it('rejects a non-Flipkart domain for the Flipkart store', () => {
    expect(isAllowedMarketplaceUrl('Flipkart', 'https://www.amazon.in/dp/B0ABCDEFG')).toBe(false);
  });

  it('rejects a Flipkart URL passed to the Amazon check', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'https://www.flipkart.com/product/p/itm123')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'not-a-url')).toBe(false);
  });

  it('rejects non-http(s) protocols', () => {
    expect(isAllowedMarketplaceUrl('Amazon', 'javascript:alert(1)//amazon.in')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isAllowedMarketplaceUrl('Flipkart', '')).toBe(false);
  });

  it('allows meesho.com product URLs', () => {
    expect(isAllowedMarketplaceUrl('Meesho', 'https://www.meesho.com/product/p/itm123')).toBe(true);
  });

  it('allows bare meesho.com without subdomain', () => {
    expect(isAllowedMarketplaceUrl('Meesho', 'https://meesho.com/product/p/itm123')).toBe(true);
  });

  it('rejects a lookalike domain that merely contains "meesho.com"', () => {
    expect(isAllowedMarketplaceUrl('Meesho', 'https://meesho.com.evil.com/product/p/itm123')).toBe(false);
  });

  it('allows myntra.com product URLs', () => {
    expect(isAllowedMarketplaceUrl('Myntra', 'https://www.myntra.com/shirts/brand/itm123')).toBe(true);
  });

  it('allows bare myntra.com without subdomain', () => {
    expect(isAllowedMarketplaceUrl('Myntra', 'https://myntra.com/shirts/brand/itm123')).toBe(true);
  });

  it('rejects a non-Myntra domain for the Myntra store', () => {
    expect(isAllowedMarketplaceUrl('Myntra', 'https://www.amazon.in/dp/B0ABCDEFG')).toBe(false);
  });

  it('allows ajio.com product URLs', () => {
    expect(isAllowedMarketplaceUrl('AJIO', 'https://www.ajio.com/p/itm123')).toBe(true);
  });

  it('allows bare ajio.com without subdomain', () => {
    expect(isAllowedMarketplaceUrl('AJIO', 'https://ajio.com/p/itm123')).toBe(true);
  });

  it('rejects a spoofed hostname prefix like "notajio.com"', () => {
    expect(isAllowedMarketplaceUrl('AJIO', 'https://notajio.com/p/itm123')).toBe(false);
  });

  it('allows nykaafashion.com product URLs', () => {
    expect(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://www.nykaafashion.com/p/itm123')).toBe(true);
  });

  it('allows bare nykaafashion.com without subdomain', () => {
    expect(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://nykaafashion.com/p/itm123')).toBe(true);
  });

  it('rejects a non-Nykaa-Fashion domain for the Nykaa Fashion store', () => {
    expect(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://www.flipkart.com/product/p/itm123')).toBe(false);
  });

  it('rejects cross-store URLs among the newly added stores', () => {
    expect(isAllowedMarketplaceUrl('Meesho', 'https://www.myntra.com/shirts/brand/itm123')).toBe(false);
    expect(isAllowedMarketplaceUrl('Myntra', 'https://www.ajio.com/p/itm123')).toBe(false);
    expect(isAllowedMarketplaceUrl('AJIO', 'https://www.nykaafashion.com/p/itm123')).toBe(false);
    expect(isAllowedMarketplaceUrl('Nykaa Fashion', 'https://www.meesho.com/product/p/itm123')).toBe(false);
  });
});
