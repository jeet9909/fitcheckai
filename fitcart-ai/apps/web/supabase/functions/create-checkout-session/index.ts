// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy create-checkout-session
// Requires secrets: STRIPE_SECRET_KEY, SUPABASE_URL (auto-provided),
// SUPABASE_SERVICE_ROLE_KEY. See ../../README.md.
//
// Creates a Stripe Checkout Session in test mode for one of the three
// FitCart plans (keys match PaywallSheet.tsx's plan prop):
//   'day'  -> Day Pass, ₹19, one-time, 24h access
//   'pro'  -> Pro, ₹149/month, recurring subscription
//   'year' -> Pro yearly, ₹999, one-time (no mandate, pushed per growth plan)

import Stripe from 'https://esm.sh/stripe@17?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const PLAN_CONFIG: Record<string, { amount: number; name: string; recurring: boolean }> = {
  day: { amount: 1900, name: 'FitCart Day Pass (24h)', recurring: false },
  pro: { amount: 14900, name: 'FitCart Pro (monthly)', recurring: true },
  year: { amount: 99900, name: 'FitCart Pro (yearly)', recurring: false },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const user = userData.user;

    const { plan } = await req.json();
    const config = PLAN_CONFIG[plan];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unknown plan: ${plan}` }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const origin = req.headers.get('Origin') ?? '';

    const session = await stripe.checkout.sessions.create({
      mode: config.recurring ? 'subscription' : 'payment',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: config.amount,
            product_data: { name: config.name },
            ...(config.recurring ? { recurring: { interval: 'month' } } : {}),
          },
          quantity: 1,
        },
      ],
      metadata: { user_id: user.id, plan },
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/checkout/cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
