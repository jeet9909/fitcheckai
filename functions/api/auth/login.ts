// POST /api/auth/login
//
// body: {email, password}. Wrong email and wrong password return the
// identical 401 {status:"invalid_credentials"} response and do comparable
// work in both cases (a dummy PBKDF2 verify against a fixed hash when the
// email isn't found), so response timing can't reveal whether an email is
// registered. Always mints a brand-new session on success — the incoming
// request's cookie (if any) is never read or reused, which is the fixation
// defense.

import { DUMMY_PASSWORD_HASH, verifyPassword } from "../../lib/crypto";
import { dbFirst } from "../../lib/db";
import { createSession } from "../../lib/session";
import { isSameOrigin } from "../../lib/csrf";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

interface SubscriptionRow {
  status: string;
  plan: string;
}

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;
const MAX_REQUEST_BODY_BYTES = 8 * 1024;

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startedAt = Date.now();

  if (!isSameOrigin(request)) {
    return jsonResponse(403, { status: "forbidden", message: "Cross-origin requests are not allowed." });
  }

  const sessionSecret = env.SESSION_SECRET?.trim();
  if (!sessionSecret) {
    console.log(JSON.stringify({ route: "/api/auth/login", status: "not_configured", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(503, { status: "not_configured", message: "Accounts are not yet configured." });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(413, { status: "invalid_request", message: "Request body is too large." });
    }
  }

  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return jsonResponse(400, { status: "invalid_request", message: "Request body must be valid JSON." });
  }

  const rawEmail = body.email;
  const rawPassword = body.password;

  if (typeof rawEmail !== "string" || rawEmail.length === 0 || rawEmail.length > MAX_EMAIL_LENGTH) {
    return jsonResponse(400, { status: "invalid_request", message: "Email is required." });
  }
  if (typeof rawPassword !== "string" || rawPassword.length === 0 || rawPassword.length > MAX_PASSWORD_LENGTH) {
    return jsonResponse(400, { status: "invalid_request", message: "Password is required." });
  }

  const email = rawEmail.trim().toLowerCase();

  const user = await dbFirst<UserRow>(env.DB, "SELECT id, email, password_hash FROM users WHERE email = ?", email);

  // Always run a PBKDF2 verify — against the real hash if the user exists,
  // against a fixed dummy hash otherwise — so timing doesn't leak whether the
  // email is registered.
  const passwordValid = await verifyPassword(rawPassword, user ? user.password_hash : DUMMY_PASSWORD_HASH);

  if (!user || !passwordValid) {
    console.log(JSON.stringify({ route: "/api/auth/login", status: "invalid_credentials", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(401, { status: "invalid_credentials" });
  }

  const { setCookieHeader } = await createSession(env, user.id);

  const subscription = await dbFirst<SubscriptionRow>(env.DB, "SELECT status, plan FROM subscriptions WHERE user_id = ?", user.id);

  console.log(JSON.stringify({ route: "/api/auth/login", status: "ok", elapsedMs: Date.now() - startedAt }));

  return jsonResponse(
    200,
    {
      status: "ok",
      user: { id: user.id, email: user.email },
      subscription: subscription ? { plan: subscription.plan, status: subscription.status } : { plan: "free", status: "none" },
    },
    { "set-cookie": setCookieHeader }
  );
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
