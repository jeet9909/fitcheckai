// POST /api/billing/checkout
//
// Requires a valid session — 401 if not logged in, checked before anything
// billing-specific. The "is this feature configured" check (STRIPE_SECRET_KEY
// + STRIPE_PRICE_ID) then runs before any billing-related D1 query or Stripe
// call, mirroring tryon.ts's honest-failure discipline. Upserts a Stripe
// customer for this user, creates a subscription-mode Checkout Session, and
// returns its URL for a top-level redirect (hosted Checkout — no Stripe.js,
// no publishable key needed).

import { dbFirst, dbRun } from "../../lib/db";
import { verifySession } from "../../lib/session";
import { isSameOrigin } from "../../lib/csrf";
import { createCheckoutSession, createCustomer, StripeApiError } from "../../lib/stripe";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
}

interface UserRow {
  id: string;
  email: string;
}

interface SubscriptionRow {
  stripe_customer_id: string | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startedAt = Date.now();

  if (!isSameOrigin(request)) {
    return jsonResponse(403, { status: "forbidden", message: "Cross-origin requests are not allowed." });
  }

  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse(401, { status: "unauthorized" });
  }

  // Config check — before any billing D1 query or Stripe call.
  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  const stripePriceId = env.STRIPE_PRICE_ID?.trim();
  if (!stripeSecretKey || !stripePriceId) {
    console.log(JSON.stringify({ route: "/api/billing/checkout", status: "not_configured", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(503, { status: "not_configured", message: "Payments not yet configured." });
  }

  const user = await dbFirst<UserRow>(env.DB, "SELECT id, email FROM users WHERE id = ?", session.userId);
  if (!user) {
    return jsonResponse(401, { status: "unauthorized" });
  }

  const origin = new URL(request.url).origin;

  const existingSubscription = await dbFirst<SubscriptionRow>(
    env.DB,
    "SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?",
    user.id
  );

  let customerId = existingSubscription?.stripe_customer_id ?? null;

  try {
    if (!customerId) {
      const customer = await createCustomer(stripeSecretKey, user.email, user.id);
      customerId = customer.id;
      const now = new Date().toISOString();
      await dbRun(
        env.DB,
        `INSERT INTO subscriptions (user_id, stripe_customer_id, status, plan, updated_at)
         VALUES (?, ?, 'none', 'free', ?)
         ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id, updated_at = excluded.updated_at`,
        user.id,
        customerId,
        now
      );
    }

    const checkoutSession = await createCheckoutSession(stripeSecretKey, {
      customerId,
      priceId: stripePriceId,
      userId: user.id,
      successUrl: `${origin}/account.html?checkout=success`,
      cancelUrl: `${origin}/pricing.html?checkout=cancelled`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a Checkout Session URL.");
    }

    console.log(JSON.stringify({ route: "/api/billing/checkout", status: "ok", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(200, { status: "ok", url: checkoutSession.url });
  } catch (err) {
    const providerStatus = err instanceof StripeApiError ? err.httpStatus : undefined;
    console.log(
      JSON.stringify({
        route: "/api/billing/checkout",
        status: "provider_error",
        providerStatus,
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(502, { status: "provider_error", message: "Unable to start checkout. Please try again shortly." });
  }
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
