// POST /api/tryon
//
// Accepts a person photo + garment photo (both base64-encoded), calls an AI
// image-editing provider to composite the garment onto the person, and returns
// the resulting image. See BRIEF.md for full product context.
//
// Two providers are supported behind one normalized interface:
//   - Eden AI (https://api.edenai.run/v3/images/edits) — preferred when
//     EDENAI_API_KEY is set. An aggregator that proxies many underlying image
//     models; not itself free (pay-per-call plus a platform fee on top of the
//     underlying provider's cost), used here because it was available when
//     Gemini's free-tier quota was exhausted.
//   - Gemini image editing (gemini-2.5-flash-image), used when only
//     GEMINI_API_KEY is set.
// If neither key is present, the honest "not_configured" response is
// returned before any body parsing or network call — never a fake image.

interface Env {
  EDENAI_API_KEY?: string;
  EDENAI_MODEL?: string;
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
// Two base64-encoded images (roughly 4/3 expansion of MAX_DECODED_BYTES each)
// plus a small amount of JSON overhead. Checked against Content-Length (when
// present) before the body is buffered/parsed, so a hostile client cannot force
// a large allocation just to get rejected by the per-field size check further
// down.
const MAX_REQUEST_BODY_BYTES = 20 * 1024 * 1024; // ~20MB
const PROVIDER_TIMEOUT_MS = 30_000;

const EDENAI_URL = "https://api.edenai.run/v3/images/edits";
const DEFAULT_EDENAI_MODEL = "openai/gpt-image-2";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EDIT_PROMPT =
  "Composite the garment from the second image onto the person in the first image. " +
  "Preserve the person's face, identity, body pose, and original background as closely " +
  "as possible. Change only the clothing.";

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

/** Normalized outcome of a provider call, independent of which provider ran. */
type ProviderResult =
  | { ok: true; image: InlineImage }
  | { ok: false; httpStatus: number; message: string; providerStatus?: number };

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

async function callGemini(apiKey: string, personImage: InlineImage, garmentImage: InlineImage): Promise<ProviderResult> {
  const payload = {
    contents: [
      {
        parts: [
          { text: EDIT_PROMPT },
          { inlineData: { mimeType: personImage.mimeType, data: personImage.data } },
          { inlineData: { mimeType: garmentImage.mimeType, data: garmentImage.data } },
        ],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      return { ok: false, httpStatus: 504, message: "The AI provider took too long to respond. Please try again." };
    }
    return { ok: false, httpStatus: 502, message: "Unable to reach the AI provider. Please try again shortly." };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return {
      ok: false,
      httpStatus: 502,
      message: "The AI provider returned an error while generating the image.",
      providerStatus: response.status,
    };
  }

  let json: GeminiResponse;
  try {
    json = (await response.json()) as GeminiResponse;
  } catch {
    return { ok: false, httpStatus: 502, message: "The AI provider returned an unreadable response." };
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (part): part is GeminiPart & { inlineData: { mimeType: string; data: string } } =>
      typeof part.inlineData?.data === "string" && part.inlineData.data.length > 0
  );

  if (!imagePart) {
    return { ok: false, httpStatus: 502, message: "The AI provider did not return an image for this request." };
  }

  return {
    ok: true,
    image: { mimeType: imagePart.inlineData.mimeType || "image/png", data: imagePart.inlineData.data },
  };
}

interface EdenAiImageData {
  url?: string;
  b64_json?: string;
}

interface EdenAiResponse {
  data?: EdenAiImageData[];
  error?: { message?: string };
}

async function callEdenAi(
  apiKey: string,
  model: string,
  personImage: InlineImage,
  garmentImage: InlineImage
): Promise<ProviderResult> {
  const payload = {
    model,
    prompt: EDIT_PROMPT,
    images: [
      { image_url: `data:${personImage.mimeType};base64,${personImage.data}` },
      { image_url: `data:${garmentImage.mimeType};base64,${garmentImage.data}` },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(EDENAI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      return { ok: false, httpStatus: 504, message: "The AI provider took too long to respond. Please try again." };
    }
    return { ok: false, httpStatus: 502, message: "Unable to reach the AI provider. Please try again shortly." };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return {
      ok: false,
      httpStatus: 502,
      message: "The AI provider returned an error while generating the image.",
      providerStatus: response.status,
    };
  }

  let json: EdenAiResponse;
  try {
    json = (await response.json()) as EdenAiResponse;
  } catch {
    return { ok: false, httpStatus: 502, message: "The AI provider returned an unreadable response." };
  }

  const entry = json.data?.[0];
  if (!entry) {
    return { ok: false, httpStatus: 502, message: "The AI provider did not return an image for this request." };
  }

  if (entry.b64_json) {
    return { ok: true, image: { mimeType: "image/png", data: entry.b64_json } };
  }

  if (entry.url) {
    // Some Eden AI-routed providers return a hosted URL instead of inline
    // base64. Fetch it once, server-side, so the client-facing contract
    // (always base64 in the response body) stays identical regardless of
    // which underlying provider produced the image.
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const imageResponse = await fetch(entry.url, { signal: fetchController.signal });
      if (!imageResponse.ok) {
        return { ok: false, httpStatus: 502, message: "Could not retrieve the generated image." };
      }
      const buffer = await imageResponse.arrayBuffer();
      const mimeType = imageResponse.headers.get("content-type") || "image/png";
      return { ok: true, image: { mimeType, data: arrayBufferToBase64(buffer) } };
    } catch {
      return { ok: false, httpStatus: 502, message: "Could not retrieve the generated image." };
    } finally {
      clearTimeout(fetchTimeout);
    }
  }

  return { ok: false, httpStatus: 502, message: "The AI provider did not return an image for this request." };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const startedAt = Date.now();

  // Step 1: the provider-configured check MUST happen before the body is read
  // or parsed, and before any network call is attempted.
  const edenApiKey = env.EDENAI_API_KEY?.trim();
  const geminiApiKey = env.GEMINI_API_KEY?.trim();
  const provider: "edenai" | "gemini" | null = edenApiKey ? "edenai" : geminiApiKey ? "gemini" : null;

  if (!provider) {
    console.log(
      JSON.stringify({
        route: "/api/tryon",
        status: "not_configured",
        elapsedMs: Date.now() - startedAt,
      })
    );
    return jsonResponse(503, {
      status: "not_configured",
      message: "AI provider not yet configured. Add GEMINI_API_KEY or EDENAI_API_KEY to enable image generation.",
    });
  }

  // Reject obviously oversized bodies before buffering/parsing them. This is a
  // cheap defense-in-depth check (Content-Length can be absent or spoofed for
  // chunked requests, so it is not a substitute for the per-field size validation
  // below) that avoids paying JSON-parse cost for payloads that can never pass
  // validation anyway.
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      console.log(
        JSON.stringify({
          route: "/api/tryon",
          status: "invalid_request",
          reason: "body_too_large",
          declaredLength,
          elapsedMs: Date.now() - startedAt,
        })
      );
      return jsonResponse(413, {
        status: "invalid_request",
        message: "Request body is too large.",
      });
    }
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
    provider,
    personMimeType: personImage.mimeType,
    personBytes: estimateDecodedBytes(personImage.data),
    garmentMimeType: garmentImage.mimeType,
    garmentBytes: estimateDecodedBytes(garmentImage.data),
  };

  // Step 3: call the selected provider.
  const result =
    provider === "edenai"
      ? await callEdenAi(edenApiKey as string, env.EDENAI_MODEL?.trim() || DEFAULT_EDENAI_MODEL, personImage, garmentImage)
      : await callGemini(geminiApiKey as string, personImage, garmentImage);

  const elapsedMs = Date.now() - startedAt;

  if (!result.ok) {
    console.log(
      JSON.stringify({
        ...logContext,
        status: "provider_error",
        providerStatus: result.providerStatus,
        elapsedMs,
      })
    );
    return jsonResponse(result.httpStatus, { status: "provider_error", message: result.message });
  }

  console.log(
    JSON.stringify({
      ...logContext,
      status: "ok",
      outputMimeType: result.image.mimeType,
      outputBytes: estimateDecodedBytes(result.image.data),
      elapsedMs,
    })
  );

  return jsonResponse(200, {
    status: "ok",
    image: { mimeType: result.image.mimeType, data: result.image.data },
  });
};

export const onRequestGet: PagesFunction<Env> = async () => {
  return jsonResponse(405, {
    status: "invalid_request",
    message: "Method not allowed. Use POST.",
  });
};
