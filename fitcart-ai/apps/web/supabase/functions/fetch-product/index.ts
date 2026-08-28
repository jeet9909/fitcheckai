// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy fetch-product
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY.
//
// Accepts { url }, detects the store from the hostname, dispatches to the
// matching per-store parser (best-effort HTML scraping — see each parser
// file for its known limitations), and upserts a successfully-parsed
// product into the `products` table using the service role key (bypasses
// RLS, which otherwise only allows public reads on that table).
//
// This does not run a headless browser and makes no attempt to evade bot
// detection (no UA rotation, no CAPTCHA solving). A store whose product
// pages are entirely client-rendered, or that blocks non-browser fetches,
// will simply return null from its parser — that is treated as an expected
// outcome here, not an error to work around.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse as parseMyntra } from './parsers/myntra.ts';
import { parse as parseAjio } from './parsers/ajio.ts';
import { parse as parseAmazon } from './parsers/amazon.ts';
import { parse as parseFlipkart } from './parsers/flipkart.ts';
import { parse as parseMeesho } from './parsers/meesho.ts';
import { parse as parseNykaaFashion } from './parsers/nykaaFashion.ts';
import type { Parser } from './parsers/types.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const STORE_PARSERS: { match: RegExp; store: string; parser: Parser }[] = [
  { match: /myntra\.com/i, store: 'Myntra', parser: parseMyntra },
  { match: /ajio\.com/i, store: 'AJIO', parser: parseAjio },
  { match: /amazon\.in/i, store: 'Amazon', parser: parseAmazon },
  { match: /flipkart\.com/i, store: 'Flipkart', parser: parseFlipkart },
  { match: /meesho\.com/i, store: 'Meesho', parser: parseMeesho },
  { match: /nykaafashion\.com/i, store: 'Nykaa Fashion', parser: parseNykaaFashion },
];

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

    const match = STORE_PARSERS.find((s) => s.match.test(url));
    if (!match) {
      return new Response(JSON.stringify({ error: 'Unsupported store for this link' }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitCartAI/1.0; +https://jeet9909.github.io/fitcheckai/)' },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${res.status}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const html = await res.text();

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

    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
