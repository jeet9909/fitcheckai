// POST /api/tryon
//
// Accepts a person photo + garment photo (both base64-encoded), calls the Gemini
// image-editing model to composite the garment onto the person, and returns the
// resulting image. See BRIEF.md for full product context.

interface Env {
  GEMINI_API_KEY?: string;
}

interface InlineImage {
  mimeType: string;
  data: string;
}

interface TryOnRequestBody {
  personImage?: InlineImage;
  garmentImage?: InlineImage;
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DECODED_BYTES = 6 * 1024 * 1024; // ~6MB
const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Estimate decoded byte length of a base64 string without fully decoding it. */
function estimateDecodedBytes(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

/** Very small structural check that a string is plausibly base64. */
function looksLikeBase64(value: string): boolean {
  if (value.length === 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function validateImage(image: unknown, fieldName: string): { ok: true; image: InlineImage } | { ok: false; message: string } {
  if (typeof image !== "object" || image === null) {
    return { ok: false, message: `${fieldName} is required.` };
  }

  const candidate = image as Record<string, unknown>;
  const mimeType = candidate.mimeType;
  const data = candidate.data;

  if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      message: `${fieldName}.mimeType must be one of image/jpeg, image/png, image/webp.`,
    };
  }

  if (typeof data !== "string" || data.length === 0) {
    return { ok: false, message: `${fieldName}.data (base64) is required.` };
  }

  if (!looksLikeBase64(data)) {
    return { ok: false, message: `${fieldName}.data must be valid base64.` };
  }

  const decodedBytes = estimateDecodedBytes(data);
  if (decodedBytes > MAX_DECODED_BYTES) {
    return { ok: false, message: `${fieldName} exceeds the maximum allowed size (~6MB).` };
  }

  return { ok: true, image: { mimeType, data } };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startedAt = Date.now();

  // Step 1: the API key check MUST happen before the body is read or parsed,
  // and before any network call is attempted.
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    console.log(
      JSON.stringify({
        route: "/api/tryon",
        status: "not_configured",
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(503, {
      status: "not_configured",
      message: "AI provider not yet configured. Add GEMINI_API_KEY to enable image generation.",
    });
  }

  // Step 2: parse + validate the request body.
  let body: TryOnRequestBody;
  try {
    body = (await request.json()) as TryOnRequestBody;
  } catch {
    return jsonResponse(400, {
      status: "invalid_request",
      message: "Request body must be valid JSON.",
    });
  }

  const personResult = validateImage(body.personImage, "personImage");
  if (!personResult.ok) {
    console.log(
      JSON.stringify({
        route: "/api/tryon",
        status: "invalid_request",
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(400, { status: "invalid_request", message: personResult.message });
  }

  const garmentResult = validateImage(body.garmentImage, "garmentImage");
  if (!garmentResult.ok) {
    console.log(
      JSON.stringify({
        route: "/api/tryon",
        status: "invalid_request",
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(400, { status: "invalid_request", message: garmentResult.message });
  }

  const personImage = personResult.image;
  const garmentImage = garmentResult.image;

  const logContext = {
    route: "/api/tryon",
    personMimeType: personImage.mimeType,
    personBytes: estimateDecodedBytes(personImage.data),
    garmentMimeType: garmentImage.mimeType,
    garmentBytes: estimateDecodedBytes(garmentImage.data),
  };

  // Step 3: call Gemini.
  const geminiPayload = {
    contents: [
      {
        parts: [
          {
            text:
              "Composite the garment from the second image onto the person in the first image. " +
              "Preserve the person's face, identity, body pose, and original background as closely " +
              "as possible. Change only the clothing.",
          },
          { inlineData: { mimeType: personImage.mimeType, data: personImage.data } },
          { inlineData: { mimeType: garmentImage.mimeType, data: garmentImage.data } },
        ],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const elapsedMs = Date.now() - startedAt;
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.log(
      JSON.stringify({
        ...logContext,
        status: isAbort ? "timeout" : "provider_error",
        elapsedMs,
      })
    );
    if (isAbort) {
      return jsonResponse(504, {
        status: "provider_error",
        message: "The AI provider took too long to respond. Please try again.",
      });
    }
    return jsonResponse(502, {
      status: "provider_error",
      message: "Unable to reach the AI provider. Please try again shortly.",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!geminiResponse.ok) {
    const elapsedMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        ...logContext,
        status: "provider_error",
        providerStatus: geminiResponse.status,
        elapsedMs,
      })
    );
    return jsonResponse(502, {
      status: "provider_error",
      message: "The AI provider returned an error while generating the image.",
    });
  }

  // Step 4: parse the response and extract the generated image.
  let geminiJson: GeminiResponse;
  try {
    geminiJson = (await geminiResponse.json()) as GeminiResponse;
  } catch {
    const elapsedMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        ...logContext,
        status: "provider_error",
        elapsedMs,
      })
    );
    return jsonResponse(502, {
      status: "provider_error",
      message: "The AI provider returned an unreadable response.",
    });
  }

  const parts = geminiJson.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (part): part is GeminiPart & { inlineData: { mimeType: string; data: string } } =>
      typeof part.inlineData?.data === "string" && part.inlineData.data.length > 0
  );

  const elapsedMs = Date.now() - startedAt;

  if (!imagePart) {
    console.log(
      JSON.stringify({
        ...logContext,
        status: "provider_error",
        elapsedMs,
      })
    );
    return jsonResponse(502, {
      status: "provider_error",
      message: "The AI provider did not return an image for this request.",
    });
  }

  console.log(
    JSON.stringify({
      ...logContext,
      status: "ok",
      outputMimeType: imagePart.inlineData.mimeType ?? "image/png",
      outputBytes: estimateDecodedBytes(imagePart.inlineData.data),
      elapsedMs,
    })
  );

  return jsonResponse(200, {
    status: "ok",
    image: {
      mimeType: "image/png",
      data: imagePart.inlineData.data,
    },
  });
};

export const onRequestGet: PagesFunction<Env> = async () => {
  return jsonResponse(405, {
    status: "invalid_request",
    message: "Method not allowed. Use POST.",
  });
};
