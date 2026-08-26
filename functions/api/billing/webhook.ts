// POST /api/billing/webhook
//
// Called by Stripe, not a logged-in browser: no cookie/session auth, no CSRF
// check (Stripe doesn't send an Origin header, and this isn't a
// cookie-authenticated request in the first place). Config check
// (STRIPE_WEBHOOK_SECRET + STRIPE_SECRET_KEY) runs first — still respond
// honestly even though the caller is Stripe, not a human. Reads the raw body
// as text before any JSON parsing (the signature covers raw bytes), verifies
// Stripe-Signature, then parses. Unhandled event types get 200
// {ignored:true} once the signature is valid, since Stripe retries
// indefinitely on any non-2xx response and we don't want retries for events
// we deliberately don't act on. A processing failure on an event we *do* act
// on (e.g. a transient D1 error) returns 500 instead, so Stripe retries and
// our subscription state doesn't silently drift out of sync.

import { dbFirst, dbRun } from "../../lib/db";
import { retrieveSubscription, StripeApiError, StripeEvent, verifyWebhookSignature } from "../../lib/stripe";

interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mapStatusToPlan(status: string): "pro" | "free" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

async function upsertSubscription(
  env: Env,
  userId: string,
  customerId: string | null,
  subscriptionId: string | null,
  status: string
): Promise<void> {
  const now = new Date().toISOString();
  const plan = mapStatusToPlan(status);
  await dbRun(
    env.DB,
    `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, plan, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       status = excluded.status,
       plan = excluded.plan,
       updated_at = excluded.updated_at`,
    userId,
    customerId,
    subscriptionId,
    status,
    plan,
    now
  );
}

/**
 * Resolve which local user a Stripe object belongs to: prefer
 * metadata.user_id (set at Checkout Session / Subscription creation time),
 * then client_reference_id (present on checkout.session objects), then a D1
 * lookup by stripe_customer_id as a last resort.
 */
async function resolveUserId(env: Env, object: Record<string, unknown>): Promise<string | null> {
  const metadata = object.metadata as Record<string, unknown> | undefined;
  if (metadata && typeof metadata.user_id === "string" && metadata.user_id) {
    return metadata.user_id;
  }
  if (typeof object.client_reference_id === "string" && object.client_reference_id) {
    return object.client_reference_id;
  }
  const customerId = typeof object.customer === "string" ? object.customer : null;
  if (!customerId) return null;
  const row = await dbFirst<{ user_id: string }>(env.DB, "SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?", customerId);
  return row?.user_id ?? null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startedAt = Date.now();

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!webhookSecret || !stripeSecretKey) {
    console.log(JSON.stringify({ route: "/api/billing/webhook", status: "not_configured", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(503, { status: "not_configured" });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  const validSignature = await verifyWebhookSignature(webhookSecret, signatureHeader, rawBody);
  if (!validSignature) {
    console.log(JSON.stringify({ route: "/api/billing/webhook", status: "invalid_signature", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(400, { status: "invalid_request", message: "Invalid webhook signature." });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    console.log(JSON.stringify({ route: "/api/billing/webhook", status: "invalid_request", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(400, { status: "invalid_request", message: "Malformed webhook payload." });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const object = event.data.object;
      const userId = await resolveUserId(env, object);
      const customerId = typeof object.customer === "string" ? object.customer : null;
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;

      if (!userId) {
        console.log(
          JSON.stringify({ route: "/api/billing/webhook", type: event.type, status: "no_user_match", elapsedMs: Date.now() - startedAt })
        );
        return jsonResponse(200, { ignored: true });
      }

      let status = "active";
      if (subscriptionId) {
        try {
          const subscription = await retrieveSubscription(stripeSecretKey, subscriptionId);
          status = subscription.status;
        } catch {
          // Fall back to an optimistic "active"; the customer.subscription.updated
          // event that follows will correct this if it's wrong.
        }
      }

      await upsertSubscription(env, userId, customerId, subscriptionId, status);
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const object = event.data.object;
      const userId = await resolveUserId(env, object);
      const customerId = typeof object.customer === "string" ? object.customer : null;
      const subscriptionId = typeof object.id === "string" ? object.id : null;
      const status =
        event.type === "customer.subscription.deleted" ? "canceled" : typeof object.status === "string" ? object.status : "canceled";

      if (!userId) {
        console.log(
          JSON.stringify({ route: "/api/billing/webhook", type: event.type, status: "no_user_match", elapsedMs: Date.now() - startedAt })
        );
        return jsonResponse(200, { ignored: true });
      }

      await upsertSubscription(env, userId, customerId, subscriptionId, status);
    } else {
      console.log(JSON.stringify({ route: "/api/billing/webhook", type: event.type, status: "ignored", elapsedMs: Date.now() - startedAt }));
      return jsonResponse(200, { ignored: true });
    }
  } catch (err) {
    const providerStatus = err instanceof StripeApiError ? err.httpStatus : undefined;
    console.log(
      JSON.stringify({
        route: "/api/billing/webhook",
        type: event.type,
        status: "handler_error",
        providerStatus,
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(500, { status: "error" });
  }

  console.log(JSON.stringify({ route: "/api/billing/webhook", type: event.type, status: "ok", elapsedMs: Date.now() - startedAt }));
  return jsonResponse(200, { status: "ok" });
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
