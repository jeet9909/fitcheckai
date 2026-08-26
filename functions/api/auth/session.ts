// GET /api/auth/session
//
// Polled by the nav bar on every page load — never returns 401. No valid
// session -> 200 {authenticated:false}. Valid session -> 200 with user +
// subscription. Not a mutating request, so no CSRF/same-origin check.

import { dbFirst } from "../../lib/db";
import { verifySession } from "../../lib/session";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

interface UserRow {
  id: string;
  email: string;
}

interface SubscriptionRow {
  status: string;
  plan: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse(200, { status: "ok", authenticated: false });
  }

  const user = await dbFirst<UserRow>(env.DB, "SELECT id, email FROM users WHERE id = ?", session.userId);
  if (!user) {
    // Session row pointed at a user that no longer exists — shouldn't happen
    // given the FK cascade on delete, but fail safe rather than 500.
    return jsonResponse(200, { status: "ok", authenticated: false });
  }

  const subscription = await dbFirst<SubscriptionRow>(env.DB, "SELECT status, plan FROM subscriptions WHERE user_id = ?", user.id);

  return jsonResponse(200, {
    status: "ok",
    authenticated: true,
    user: { id: user.id, email: user.email },
    subscription: subscription ? { plan: subscription.plan, status: subscription.status } : { plan: "free", status: "none" },
  });
};

export const onRequestPost: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use GET." });
};
