// Session cookie lifecycle: create (random token, HMAC-signed cookie, only
// the token's SHA-256 hash stored in D1), verify (parse + signature check
// before any DB call, then a D1 lookup + expiry check), and destroy (delete
// the D1 row, clear the cookie regardless of whether one existed). Session
// lifetime is 30 days. The raw token never touches D1 or logs — only its hash
// does.

import { hmacSign, hmacVerify, randomToken, sha256Hex } from "./crypto";
import { dbFirst, dbRun } from "./db";

const COOKIE_NAME = "fc_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_TOKEN_BYTES = 32;

export interface SessionEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  const attrs = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax"];
  if (maxAgeSeconds <= 0) {
    attrs.push("Max-Age=0");
    attrs.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  } else {
    attrs.push(`Max-Age=${maxAgeSeconds}`);
  }
  return attrs.join("; ");
}

export function clearSessionCookieHeader(): string {
  return serializeCookie(COOKIE_NAME, "", 0);
}

/** Signed cookie value: "<token>.<hmac_hex>". */
async function signToken(secret: string, token: string): Promise<string> {
  const signature = await hmacSign(secret, token);
  return `${token}.${signature}`;
}

/** Verify + extract the raw token from a signed cookie value. Returns null if malformed or the signature doesn't match — checked before any D1 call. */
async function verifyTokenSignature(secret: string, signed: string): Promise<string | null> {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const token = signed.slice(0, dotIndex);
  const signature = signed.slice(dotIndex + 1);
  if (!token || !signature) return null;
  const valid = await hmacVerify(secret, token, signature);
  return valid ? token : null;
}

function requireSecret(env: SessionEnv): string {
  const secret = env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  return secret;
}

export interface CreateSessionResult {
  setCookieHeader: string;
}

/**
 * Create a brand-new session for a user and return the Set-Cookie header to
 * attach to the response. Callers (e.g. login) must never reuse an existing
 * cookie's session — always mint a fresh one, to defend against session
 * fixation. Throws if SESSION_SECRET isn't configured; callers are expected
 * to have already checked that (same honest-failure discipline as tryon.ts).
 */
export async function createSession(env: SessionEnv, userId: string): Promise<CreateSessionResult> {
  const secret = requireSecret(env);
  const token = randomToken(SESSION_TOKEN_BYTES);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000);

  await dbRun(
    env.DB,
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    tokenHash,
    userId,
    expiresAt.toISOString(),
    now.toISOString()
  );

  const signed = await signToken(secret, token);
  return { setCookieHeader: serializeCookie(COOKIE_NAME, signed, SESSION_LIFETIME_SECONDS) };
}

export interface VerifiedSession {
  userId: string;
}

/** Verify the session cookie on an incoming request. Returns null if absent, malformed, forged, unknown, or expired — never throws. */
export async function verifySession(request: Request, env: SessionEnv): Promise<VerifiedSession | null> {
  const secret = env.SESSION_SECRET?.trim();
  if (!secret) return null;

  const cookies = parseCookies(request.headers.get("cookie"));
  const signed = cookies[COOKIE_NAME];
  if (!signed) return null;

  const token = await verifyTokenSignature(secret, signed);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await dbFirst<SessionRow>(env.DB, "SELECT id, user_id, expires_at FROM sessions WHERE id = ?", tokenHash);
  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    // Expired: clean up lazily and treat as unauthenticated.
    await dbRun(env.DB, "DELETE FROM sessions WHERE id = ?", tokenHash);
    return null;
  }

  return { userId: row.user_id };
}

/**
 * Destroy the session referenced by the incoming request's cookie, if any:
 * deletes the D1 row and returns a Set-Cookie header that clears the cookie.
 * Idempotent — safe to call with no active session or no SESSION_SECRET.
 */
export async function destroySession(request: Request, env: SessionEnv): Promise<string> {
  const secret = env.SESSION_SECRET?.trim();
  if (secret) {
    const cookies = parseCookies(request.headers.get("cookie"));
    const signed = cookies[COOKIE_NAME];
    if (signed) {
      const token = await verifyTokenSignature(secret, signed);
      if (token) {
        const tokenHash = await sha256Hex(token);
        await dbRun(env.DB, "DELETE FROM sessions WHERE id = ?", tokenHash);
      }
    }
  }
  return clearSessionCookieHeader();
}
