// POST /api/auth/logout
//
// Deletes the session's D1 row (not just the cookie) and clears the cookie
// regardless of whether a session existed. Always 200 — idempotent, no error
// state, safe to call whether or not the caller was ever logged in.

import { destroySession } from "../../lib/session";
import { isSameOrigin } from "../../lib/csrf";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isSameOrigin(request)) {
    return jsonResponse(403, { status: "forbidden", message: "Cross-origin requests are not allowed." });
  }

  const clearCookieHeader = await destroySession(request, env);

  console.log(JSON.stringify({ route: "/api/auth/logout", status: "ok" }));

  return jsonResponse(200, { status: "ok" }, { "set-cookie": clearCookieHeader });
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
