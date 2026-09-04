// Unit tests for the size-cap and redirect-host-verification helpers added
// alongside the two search-results scrapers (see amazonSearchScraper.ts /
// flipkartSearchScraper.ts). These are exercised directly here (rather than
// only indirectly through the scraper-level tests) since forcing a >5MB
// response or a monkey-patched `Response.url` through the full scrape flow
// would be slow/awkward — the scrapers themselves just call these two
// functions and trust the result, which the orchestrator-level tests
// already cover end-to-end.

import { assert, assertEquals, assertRejects } from '../_testUtils.ts';
import { decodeHtmlEntities, isExpectedHost, parseIndianPrice, readCappedText, textFromHtml, upsizeAmazonImageUrl } from './htmlUtils.ts';

// Regression coverage for the entity table's growth: fetch-product/parsers/
// amazon.ts now routes real Amazon product-description/material prose
// through textFromHtml (a use this table's original scoping comment never
// anticipated — it was written for short search-tile titles only), and real
// marketing copy routinely uses these named entities.
Deno.test('decodeHtmlEntities: decodes the marketing-copy entities added for description/material prose', () => {
  assertEquals(decodeHtmlEntities('Premium quality &mdash; built to last'), 'Premium quality — built to last');
  assertEquals(decodeHtmlEntities('100% cotton &ndash; breathable'), '100% cotton – breathable');
  assertEquals(decodeHtmlEntities('Soft, durable&hellip;'), 'Soft, durable…');
  assertEquals(decodeHtmlEntities('&lsquo;Classic Fit&rsquo;'), '‘Classic Fit’');
  assertEquals(decodeHtmlEntities('&ldquo;Machine washable&rdquo;'), '“Machine washable”');
  assertEquals(decodeHtmlEntities('Acme&reg; Sportswear&trade;'), 'Acme® Sportswear™');
  assertEquals(decodeHtmlEntities('Fits up to 40&deg;C wash'), 'Fits up to 40°C wash');
});

Deno.test('textFromHtml: strips tags and decodes the new entities together, as amazon.ts\'s description extraction relies on', () => {
  const html = '<span>Premium fabric &mdash; a &ldquo;classic&rdquo; fit&hellip;</span>';
  assertEquals(textFromHtml(html), 'Premium fabric — a “classic” fit…');
});

Deno.test('readCappedText: returns the full body when under the cap', async () => {
  const res = new Response('hello world', { status: 200 });
  const text = await readCappedText(res, 1024);
  assertEquals(text, 'hello world');
});

Deno.test('readCappedText: rejects once the body exceeds the byte cap, instead of buffering it all', async () => {
  const res = new Response('x'.repeat(1000), { status: 200 });
  await assertRejects(() => readCappedText(res, 10), 'expected readCappedText to reject a body over the cap');
});

Deno.test('readCappedText: falls back to res.text() when there is no body stream to bound-check', async () => {
  const res = new Response(null, { status: 204 });
  const text = await readCappedText(res, 10);
  assertEquals(text, '');
});

Deno.test('isExpectedHost: allows an exact host match', () => {
  assert(isExpectedHost('https://www.amazon.in/s?k=shirt', 'amazon.in'));
});

Deno.test('isExpectedHost: allows a subdomain of the expected host', () => {
  assert(isExpectedHost('https://smile.amazon.in/s?k=shirt', 'amazon.in'));
});

Deno.test('isExpectedHost: denies a redirect to an unrelated/attacker-controlled host', () => {
  assert(!isExpectedHost('https://evil.example.com/phish', 'amazon.in'));
});

Deno.test('isExpectedHost: denies a lookalike host that merely contains the expected host as a substring', () => {
  assert(!isExpectedHost('https://notamazon.in.evil.example.com/', 'amazon.in'));
});

Deno.test('isExpectedHost: treats an empty url (no redirect info available, e.g. a manually-built test Response) as passing', () => {
  assert(isExpectedHost('', 'amazon.in'));
});

Deno.test('isExpectedHost: denies a malformed URL rather than throwing', () => {
  assert(!isExpectedHost('not a url', 'amazon.in'));
});

// Regression tests for two real bugs found in parseIndianPrice:
//   1. It never rounded, so a fractional scraped price (e.g. "₹599.50")
//      flowed all the way to `upsertListings`' single `.upsert()` call for
//      a store and made Postgres reject the *entire* batch, since
//      `products.price`/`mrp` are `integer not null` columns.
//   2. Its own docstring example, "Rs. 1,999.00", actually returned null:
//      the old sanitizer (`text.replace(/[^0-9.]/g, '')`) ran before
//      stripping "Rs.", so the period in "Rs." survived alongside the
//      number's own decimal point, producing ".1999.00" -> NaN -> null.

Deno.test('parseIndianPrice: the docstring\'s own "Rs. 1,999.00" example now parses correctly', () => {
  assertEquals(parseIndianPrice('Rs. 1,999.00'), 1999);
});

Deno.test('parseIndianPrice: "Rs." with no space before the digits', () => {
  assertEquals(parseIndianPrice('Rs.1,999.00'), 1999);
});

Deno.test('parseIndianPrice: "Rs " (no period) still works, as it always did', () => {
  assertEquals(parseIndianPrice('Rs 1,999.00'), 1999);
});

Deno.test('parseIndianPrice: "INR" prefix', () => {
  assertEquals(parseIndianPrice('INR 449'), 449);
});

Deno.test('parseIndianPrice: a fractional price is rounded to the nearest integer', () => {
  assertEquals(parseIndianPrice('₹599.50'), 600);
});

Deno.test('parseIndianPrice: rounds down when the fractional part is under .5', () => {
  assertEquals(parseIndianPrice('₹599.40'), 599);
});

Deno.test('parseIndianPrice: the rupee symbol with a comma-separated whole number still works', () => {
  assertEquals(parseIndianPrice('₹1,999'), 1999);
});

Deno.test('parseIndianPrice: a plain comma-separated number with no currency marker still works', () => {
  assertEquals(parseIndianPrice('3,389'), 3389);
});

Deno.test('parseIndianPrice: an empty/non-numeric string returns null rather than 0 or NaN', () => {
  assertEquals(parseIndianPrice(''), null);
  assertEquals(parseIndianPrice('Currently unavailable'), null);
});

Deno.test('upsizeAmazonImageUrl: swaps a single size token for a full-resolution one', () => {
  assertEquals(
    upsizeAmazonImageUrl('https://m.media-amazon.com/images/I/51KYvMSM-DL._AC_UL320_.jpg'),
    'https://m.media-amazon.com/images/I/51KYvMSM-DL._AC_SL1500_.jpg',
  );
});

Deno.test('upsizeAmazonImageUrl: swaps a compound size token (e.g. a deals-widget tile URL) the same way', () => {
  assertEquals(
    upsizeAmazonImageUrl('https://m.media-amazon.com/images/I/41WWfdm+AsL._AC_UL225_SR225,160_.jpg'),
    'https://m.media-amazon.com/images/I/41WWfdm+AsL._AC_SL1500_.jpg',
  );
});

Deno.test('upsizeAmazonImageUrl: preserves a query string after the extension, if present', () => {
  assertEquals(
    upsizeAmazonImageUrl('https://m.media-amazon.com/images/I/51KYvMSM-DL._AC_UL320_.jpg?foo=bar'),
    'https://m.media-amazon.com/images/I/51KYvMSM-DL._AC_SL1500_.jpg?foo=bar',
  );
});

Deno.test("upsizeAmazonImageUrl: leaves a URL that doesn't match Amazon's /images/I/ pattern unchanged, rather than mangling it", () => {
  const nonMatching = 'https://example.com/some/other/path.jpg';
  assertEquals(upsizeAmazonImageUrl(nonMatching), nonMatching);
});
