// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// (--no-verify-jwt because Stripe calls this directly, not through a signed-in
// Supabase session — auth is instead the Stripe signature check below.)
//
// Point a Stripe webhook endpoint (test mode) at this function's URL,
// subscribed to: checkout.session.completed, customer.subscription.updated.
// Requires secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL
// (auto-provided), SUPABASE_SERVICE_ROLE_KEY.

import Stripe from 'https://esm.sh/stripe@17?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id ?? session.client_reference_id;
    const plan = session.metadata?.plan;
    if (userId && plan) {
      await supabaseAdmin.from('subscriptions').insert({
        user_id: userId,
        stripe_customer_id: String(session.customer ?? ''),
        stripe_subscription_id: session.subscription ? String(session.subscription) : null,
        plan,
        status: 'active',
      });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
