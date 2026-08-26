// Raw fetch-based Stripe REST client — no `stripe` npm SDK (it requires the
// nodejs_compat flag, which nothing else in this project uses; this stays
// consistent with tryon.ts's hand-rolled-fetch pattern for third-party APIs).
// Stripe's REST API takes application/x-www-form-urlencoded bodies (not
// JSON), and nested objects/arrays use bracket notation — see `toFormBody`.
// Test mode vs. live mode is entirely a property of which secret key is
// passed in (sk_test_... vs sk_live_...); this client doesn't care.

import { constantTimeEqual, hmacSign } from "./crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2024-06-20";
const STRIPE_TIMEOUT_MS = 15_000;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60; // 5 minutes

export interface StripeCustomer {
  id: string;
  email?: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

export interface StripePortalSession {
  id: string;
  url: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

type FormValue = string | number | boolean | undefined | null | FormValue[] | { [key: string]: FormValue };

function appendFormValue(params: URLSearchParams, key: string, value: FormValue): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendFormValue(params, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === "object") {
    for (const [subKey, subValue] of Object.entries(value)) {
      appendFormValue(params, `${key}[${subKey}]`, subValue);
    }
    return;
  }
  params.append(key, String(value));
}

function toFormBody(fields: Record<string, FormValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    appendFormValue(params, key, value);
  }
  return params.toString();
}

export class StripeApiError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "StripeApiError";
    this.httpStatus = httpStatus;
  }
}

async function stripeRequest<T>(secretKey: string, method: "GET" | "POST", path: string, fields?: Record<string, FormValue>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);

  try {
    const isGet = method === "GET";
    const url = isGet && fields ? `${STRIPE_API_BASE}${path}?${toFormBody(fields)}` : `${STRIPE_API_BASE}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${secretKey}`,
          "stripe-version": STRIPE_API_VERSION,
          ...(isGet ? {} : { "content-type": "application/x-www-form-urlencoded" }),
        },
        body: !isGet && fields ? toFormBody(fields) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new StripeApiError(isAbort ? "Stripe API request timed out." : "Unable to reach Stripe.", isAbort ? 504 : 502);
    }

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const message = (json?.error as { message?: string } | undefined)?.message || "Stripe API request failed.";
      throw new StripeApiError(message, response.status);
    }

    return json as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createCustomer(secretKey: string, email: string, userId: string): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(secretKey, "POST", "/customers", {
    email,
    metadata: { user_id: userId },
  });
}

export async function retrieveCustomer(secretKey: string, customerId: string): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(secretKey, "GET", `/customers/${encodeURIComponent(customerId)}`);
}

export async function retrieveSubscription(secretKey: string, subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(secretKey, "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export interface CreateCheckoutSessionParams {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(secretKey: string, params: CreateCheckoutSessionParams): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(secretKey, "POST", "/checkout/sessions", {
    customer: params.customerId,
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    client_reference_id: params.userId,
    metadata: { user_id: params.userId },
    // Copied onto the created Subscription object too, so
    // customer.subscription.* webhook events carry user_id directly without
    // needing a customer-id lookup back to our DB.
    subscription_data: { metadata: { user_id: params.userId } },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export async function createPortalSession(secretKey: string, params: CreatePortalSessionParams): Promise<StripePortalSession> {
  return stripeRequest<StripePortalSession>(secretKey, "POST", "/billing_portal/sessions", {
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

/**
 * Verify Stripe's `Stripe-Signature` header: `t=<timestamp>,v1=<hex_hmac>`.
 * The signature covers `${t}.${rawBody}` (HMAC-SHA256 with the webhook
 * secret, hex-encoded), compared in constant time. Rejects if `t` is more
 * than 5 minutes from now (replay defense).
 */
export async function verifyWebhookSignature(webhookSecret: string, signatureHeader: string | null, rawBody: string): Promise<boolean> {
  if (!signatureHeader) return false;

  let timestamp: string | undefined;
  let v1Signature: string | undefined;
  for (const part of signatureHeader.split(",")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1" && !v1Signature) v1Signature = value;
  }

  if (!timestamp || !v1Signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expectedHex = await hmacSign(webhookSecret, `${timestamp}.${rawBody}`);
  return constantTimeEqual(expectedHex, v1Signature);
}
