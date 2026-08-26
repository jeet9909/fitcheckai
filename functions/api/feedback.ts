// POST /api/feedback
//
// Captures the single lightweight feedback signal this MVP needs: "does this look
// like you, and would it affect a purchase decision?" There is intentionally no
// KV/DB in this build — the structured console.log line below is the retrieval
// mechanism, read back via `wrangler pages deployment tail`. Never receives or
// logs image data.

interface FeedbackRequestBody {
  looksLikeYou?: unknown;
  wouldAffectPurchase?: unknown;
  comment?: unknown;
  timestamp?: unknown;
}

const MAX_COMMENT_LENGTH = 2000;

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

  let body: FeedbackRequestBody;
  try {
    body = (await request.json()) as FeedbackRequestBody;
  } catch {
    return jsonResponse(400, {
      status: "invalid_request",
      message: "Request body must be valid JSON.",
    });
  }

  const { looksLikeYou, wouldAffectPurchase, comment, timestamp } = body;

  if (typeof looksLikeYou !== "boolean") {
    return jsonResponse(400, {
      status: "invalid_request",
      message: "looksLikeYou (boolean) is required.",
    });
  }

  if (typeof wouldAffectPurchase !== "boolean") {
    return jsonResponse(400, {
      status: "invalid_request",
      message: "wouldAffectPurchase (boolean) is required.",
    });
  }

  if (comment !== undefined && comment !== null) {
    if (typeof comment !== "string") {
      return jsonResponse(400, {
        status: "invalid_request",
        message: "comment must be a string.",
      });
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return jsonResponse(400, {
        status: "invalid_request",
        message: `comment must be under ${MAX_COMMENT_LENGTH} characters.`,
      });
    }
  }

  if (typeof timestamp !== "string" || !isValidTimestamp(timestamp)) {
    return jsonResponse(400, {
      status: "invalid_request",
      message: "timestamp (ISO string) is required.",
    });
  }

  console.log(
    JSON.stringify({
      route: "/api/feedback",
      status: "ok",
      looksLikeYou,
      wouldAffectPurchase,
      comment: typeof comment === "string" ? comment : null,
      timestamp,
      receivedAt: new Date().toISOString(),
    })
  );

  return jsonResponse(200, { status: "ok" });
};

export const onRequestGet: PagesFunction = async () => {
  return jsonResponse(405, {
    status: "invalid_request",
    message: "Method not allowed. Use POST.",
  });
};
