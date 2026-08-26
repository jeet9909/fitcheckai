// POST /api/waitlist
//
// Captures a Studio 3D waitlist signup. Mirrors feedback.ts: no DB table for
// this (logging is sufficient per BRIEF.md's minimal-schema instruction) — a
// structured console.log line is the retrieval mechanism, read back via
// `wrangler pages deployment tail`. This is a real user email, so it's logged
// as metadata only — no extra fields beyond what's needed to work the
// waitlist.

interface WaitlistRequestBody {
  email?: unknown;
  timestamp?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
// The whole request body (an email + an ISO timestamp) is only ever a few
// hundred bytes. Reject anything wildly larger before buffering/parsing it.
const MAX_REQUEST_BODY_BYTES = 8 * 1024;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isValidTimestamp(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export const onRequestPost: PagesFunction = async (context) => {
  const { request } = context;

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(413, { status: "invalid_request", message: "Request body is too large." });
    }
  }

  let body: WaitlistRequestBody;
  try {
    body = (await request.json()) as WaitlistRequestBody;
  } catch {
    return jsonResponse(400, { status: "invalid_request", message: "Request body must be valid JSON." });
  }

  const { email, timestamp } = body;

  if (typeof email !== "string" || email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return jsonResponse(400, { status: "invalid_request", message: "A valid email is required." });
  }

  if (typeof timestamp !== "string" || !isValidTimestamp(timestamp)) {
    return jsonResponse(400, { status: "invalid_request", message: "timestamp (ISO string) is required." });
  }

  console.log(
    JSON.stringify({
      route: "/api/waitlist",
      status: "ok",
      email: email.trim().toLowerCase(),
      timestamp,
      receivedAt: new Date().toISOString(),
    })
  );

  return jsonResponse(200, { status: "ok" });
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, { status: "invalid_request", message: "Method not allowed. Use POST." });
};
