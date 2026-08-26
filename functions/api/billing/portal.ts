// POST /api/billing/portal
//
// Requires a valid session — 401 if not logged in. Config check
// (STRIPE_SECRET_KEY) runs before any billing D1 query or Stripe call.
// Requires an existing stripe_customer_id (created during a prior checkout);
// if there isn't one, 400 rather than a broken Stripe call.

import { dbFirst } from "../../lib/db";
import { verifySession } from "../../lib/session";
import { isSameOrigin } from "../../lib/csrf";
import { createPortalSession, StripeApiError } from "../../lib/stripe";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
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

  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) {
    console.log(JSON.stringify({ route: "/api/billing/portal", status: "not_configured", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(503, { status: "not_configured", message: "Payments not yet configured." });
  }

  const subscription = await dbFirst<SubscriptionRow>(
    env.DB,
    "SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?",
    session.userId
  );

  if (!subscription?.stripe_customer_id) {
    return jsonResponse(400, { status: "invalid_request", message: "No billing account yet." });
  }

  const origin = new URL(request.url).origin;

  try {
    const portalSession = await createPortalSession(stripeSecretKey, {
      customerId: subscription.stripe_customer_id,
      returnUrl: `${origin}/account.html`,
    });

    console.log(JSON.stringify({ route: "/api/billing/portal", status: "ok", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(200, { status: "ok", url: portalSession.url });
  } catch (err) {
    const providerStatus = err instanceof StripeApiError ? err.httpStatus : undefined;
    console.log(
      JSON.stringify({
        route: "/api/billing/portal",
        status: "provider_error",
        providerStatus,
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(502, { status: "provider_error", message: "Unable to open the billing portal. Please try again shortly." });
  }
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
