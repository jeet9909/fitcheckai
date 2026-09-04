// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy fetch-product
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY.
//
// Accepts { url }, detects the store from the hostname, dispatches to the
// matching per-store parser (best-effort HTML scraping - see each parser
// file for its known limitations), and upserts a successfully-parsed
// product into the `products` table using the service role key (bypasses
// RLS, which otherwise only allows public reads on that table).
//
// This does not run a headless browser and makes no attempt to evade bot
// detection (no UA rotation, no CAPTCHA solving). A store whose product
// pages are entirely client-rendered, or that blocks non-browser fetches,
// will simply return null from its parser - that is treated as an expected
// outcome here, not an error to work around.
//
// Richer fields (description/material/sizeChart/imageUrls) a parser
// returns are written through curate-product's own updateProduct() helper
// (see buildEnrichmentInput below) - the same validated, TOCTOU-safe,
// per-store-allowlist-checked write path human curation already uses, so
// this function never duplicates that validation logic.
//
// Fetch-target validation, hardened 2026-09-05 (SSRF-shaped surface found
// during a security review of the enrich-catalog feature): findParserEntryForUrl's
// STORE_PARSERS regexes (e.g. /amazon.in/i) only need the store name to
// appear somewhere in the URL string - they never anchor to the URL's
// actual hostname. That alone means a URL like
// https://attacker.example/redirect?to=amazon.in (or, worse, a cloud
// metadata endpoint URL containing that same substring) would satisfy the
// regex and previously went straight into a bare fetch(url) with no further
// check - a real SSRF primitive reachable by any caller of this function
// (this function carries no secret of its own, unlike the admin-only
// curate-product/enrich-catalog functions), whose success path now also
// writes attacker-influenced description/material text into the public
// catalog via the enrichment write below. Fixed the same way
// enrich-catalog/candidates.ts (built earlier this same session) already
// treats exactly this class of request: re-validate the fetch target itself
// against search-products/urlAllowlist.ts's isAllowedMarketplaceUrl (a real
// hostname check, not a substring match) for the store the regex claims to
// have matched, use fetchWithTimeout/readCappedText instead of a bare
// fetch()/res.text() (bounded time and bounded response size), and verify
// the post-redirect response URL is still on that same allowlisted host
// (isExpectedHost) before trusting the body enough to parse it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { findParserEntryForUrl } from './parsers/storeParsers.ts';
import { updateProduct } from '../curate-product/updateProduct.ts';
import { buildEnrichmentInput } from './enrichmentInput.ts';
import { isAllowedMarketplaceUrl } from '../search-products/urlAllowlist.ts';
import { capMessage, fetchWithTimeout, isExpectedHost, readCappedText } from '../search-products/scraping/htmlUtils.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const match = findParserEntryForUrl(url);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Unsupported store for this link' }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // See the file header comment: findParserEntryForUrl's regex only
    // confirms the store name appears somewhere in the URL string, not that
    // the URL's actual hostname belongs to that store. This is the real
    // gate on what host this function is about to make a real outbound
    // request to.
    if (!isAllowedMarketplaceUrl(match.store, url)) {
      return new Response(JSON.stringify({ error: "This URL isn't on a domain recognized for that store." }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // isAllowedMarketplaceUrl above already confirmed `url` parses as a real
    // URL, so this can't throw.
    const expectedHost = new URL(url).hostname;

    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitCartAI/1.0; +https://jeet9909.github.io/fitcheckai/)' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${capMessage(err)}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${res.status}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    // Defense against a hijacked/compromised redirect sending this request
    // to an attacker-controlled or internal host whose response would
    // otherwise be parsed and trusted - see htmlUtils.ts's isExpectedHost.
    if (!isExpectedHost(res.url, expectedHost)) {
      return new Response(JSON.stringify({ error: 'Response came from an unexpected host after redirect(s).' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const html = await readCappedText(res);

    const parsed = match.parser(html, url);
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Could not parse this page' }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(
        {
          name: parsed.name,
          brand: parsed.brand,
          store: match.store,
          category: 'Unknown',
          price: parsed.price,
          mrp: parsed.mrp,
          color: parsed.color,
          product_url: url,
          image_url: parsed.imageUrl,
          size_chart: parsed.sizeChart,
          source: 'scraped',
          scraped_at: new Date().toISOString(),
        },
        { onConflict: 'product_url' },
      )
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Richer fields (description/material/sizeChart/imageUrls), when the
    // parser found any of them, are written via the exact same validated,
    // TOCTOU-safe, per-store-allowlist-checked path curate-product's own
    // manual-curation endpoint uses - never reimplemented here. This is a
    // second, best-effort write on top of the base upsert above (which has
    // already succeeded by this point): a failure here is logged and
    // reported back in the response's `enrichment` field, but never turns
    // an otherwise-successful "product added" outcome into an error - the
    // base row is real and saved either way.
    const enrichmentInput = buildEnrichmentInput(parsed);
    let enrichment: { ok: true; updated: unknown } | { ok: false; error: string } | undefined;
    if (enrichmentInput) {
      const productId = (data as { id: number }).id;
      const result = await updateProduct(supabaseAdmin, { productId, ...enrichmentInput });
      if (result.ok) {
        enrichment = { ok: true, updated: result.updated };
      } else {
        console.error(`[fetch-product] enrichment write failed for product ${productId}:`, result.error);
        enrichment = { ok: false, error: result.error };
      }
    }

    return new Response(JSON.stringify({ ...data, ...(enrichment ? { enrichment } : {}) }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
