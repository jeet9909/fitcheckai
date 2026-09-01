// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy search-products
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY,
// plus per-store credentials — see amazonPaapi.ts / flipkartAffiliate.ts.
//
// Real multi-item catalog search across Amazon and Flipkart via their
// official affiliate/product APIs — this is what replaced the hardcoded
// demo product list on Discover. Deliberately does NOT fall back to mock/
// placeholder results when a store's credentials aren't set: the entire
// point of this function is that the catalog only ever holds real listings,
// so an unconfigured store returns an honest "not configured" response
// instead. Myntra/AJIO/Meesho/Nykaa Fashion have no public catalog API —
// those stay on fetch-product's single-URL paste flow.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAmazonConfigured, searchAmazon } from './amazonPaapi.ts';
import { isFlipkartConfigured, searchFlipkart } from './flipkartAffiliate.ts';
import type { StoreListing } from './types.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

type Store = 'amazon' | 'flipkart';

const PROVIDERS: Record<Store, { configured: () => boolean; search: (q: string) => Promise<StoreListing[]>; label: string }> = {
  amazon: { configured: isAmazonConfigured, search: searchAmazon, label: 'Amazon' },
  flipkart: { configured: isFlipkartConfigured, search: searchFlipkart, label: 'Flipkart' },
};

async function upsertListings(listings: StoreListing[]): Promise<number> {
  if (listings.length === 0) return 0;
  const { error } = await supabaseAdmin.from('products').upsert(
    listings.map((l) => ({
      name: l.name,
      brand: l.brand,
      store: l.store,
      category: 'Unknown',
      price: l.price,
      mrp: l.mrp,
      color: l.color,
      product_url: l.productUrl,
      image_url: l.imageUrl,
      source: `${l.store.toLowerCase()}-affiliate`,
      scraped_at: new Date().toISOString(),
    })),
    { onConflict: 'product_url' },
  );
  if (error) throw error;
  return listings.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { query, store } = await req.json();
    if (!query || typeof query !== 'string') {
      return json({ error: 'Missing query' }, 400);
    }

    const provider = PROVIDERS[store as Store];
    if (!provider) {
      return json({ error: `Unknown store: ${store}. Supported: amazon, flipkart.` }, 400);
    }

    if (!provider.configured()) {
      return json({
        error: 'not_configured',
        message: `${provider.label} search isn't connected yet — affiliate API credentials aren't set.`,
      }, 501);
    }

    const listings = await provider.search(query);
    const upserted = await upsertListings(listings);

    return json({ store, query, count: listings.length, upserted });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
