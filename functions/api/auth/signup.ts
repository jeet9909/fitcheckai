// POST /api/auth/signup
//
// body: {email, password}. Validates email shape and password length, hashes
// the password (lib/crypto, PBKDF2), inserts the user, and mints a brand-new
// session. Same discipline as tryon.ts: the "is this feature configured"
// check (SESSION_SECRET, required to sign the session cookie) runs before any
// body parsing or D1 work.

import { hashPassword } from "../../lib/crypto";
import { dbFirst, dbRun } from "../../lib/db";
import { createSession } from "../../lib/session";
import { isSameOrigin } from "../../lib/csrf";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

interface SignupRequestBody {
  email?: unknown;
  password?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
// Bounds PBKDF2 cost (and general abuse) — long enough for any real
// passphrase, short enough that hashing stays cheap and predictable.
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

  // Step 1: config check, before any body parsing or D1 work.
  const sessionSecret = env.SESSION_SECRET?.trim();
  if (!sessionSecret) {
    console.log(JSON.stringify({ route: "/api/auth/signup", status: "not_configured", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(503, { status: "not_configured", message: "Accounts are not yet configured." });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(413, { status: "invalid_request", message: "Request body is too large." });
    }
  }

  let body: SignupRequestBody;
  try {
    body = (await request.json()) as SignupRequestBody;
  } catch {
    return jsonResponse(400, { status: "invalid_request", message: "Request body must be valid JSON." });
  }

  const rawEmail = body.email;
  const rawPassword = body.password;

  if (typeof rawEmail !== "string" || rawEmail.length === 0 || rawEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(rawEmail)) {
    return jsonResponse(400, { status: "invalid_request", message: "A valid email is required." });
  }

  if (typeof rawPassword !== "string" || rawPassword.length < MIN_PASSWORD_LENGTH || rawPassword.length > MAX_PASSWORD_LENGTH) {
    return jsonResponse(400, {
      status: "invalid_request",
      message: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    });
  }

  const email = rawEmail.trim().toLowerCase();

  const existing = await dbFirst<{ id: string }>(env.DB, "SELECT id FROM users WHERE email = ?", email);
  if (existing) {
    console.log(JSON.stringify({ route: "/api/auth/signup", status: "email_taken", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(409, { status: "email_taken" });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(rawPassword);
  const now = new Date().toISOString();

  try {
    await dbRun(
      env.DB,
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      userId,
      email,
      passwordHash,
      now
    );
  } catch (err) {
    // Unique-constraint race: two signups for the same email landed
    // concurrently and both passed the SELECT check above.
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("unique")) {
      console.log(JSON.stringify({ route: "/api/auth/signup", status: "email_taken", raced: true, elapsedMs: Date.now() - startedAt }));
      return jsonResponse(409, { status: "email_taken" });
    }
    console.log(JSON.stringify({ route: "/api/auth/signup", status: "error", elapsedMs: Date.now() - startedAt }));
    return jsonResponse(500, { status: "error", message: "Something went wrong. Please try again." });
  }

  const { setCookieHeader } = await createSession(env, userId);

  console.log(JSON.stringify({ route: "/api/auth/signup", status: "ok", elapsedMs: Date.now() - startedAt }));

  return jsonResponse(201, { status: "ok", user: { id: userId, email } }, { "set-cookie": setCookieHeader });
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
