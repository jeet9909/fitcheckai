// Password hashing (PBKDF2-HMAC-SHA256 via the Workers runtime's native
// crypto.subtle — no external auth service, per BRIEF.md) plus generic HMAC
// sign/verify and constant-time compare helpers reused by session cookie
// signing (session.ts) and Stripe webhook signature verification (stripe.ts).
// This module never logs a password, token, or derived key.

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < arr.length; i += chunkSize) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string compare, to avoid leaking a match/mismatch via early-exit timing. Inputs of different length are never equal (length itself isn't the secret being protected here). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH }, keyMaterial, DERIVED_KEY_BITS);
  return new Uint8Array(derived);
}

/**
 * Hash a password into a self-describing string:
 * `pbkdf2$<iterations>$<salt_b64>$<hash_b64>` — so the iteration count can be
 * bumped later without invalidating hashes created under the old count.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verify a password against a stored hash string. Parses the stored format
 * (iteration count, salt) rather than assuming the current PBKDF2_ITERATIONS,
 * so previously issued hashes keep verifying correctly after that constant
 * changes.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(parts[2] as string);
    expected = fromBase64(parts[3] as string);
  } catch {
    return false;
  }

  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  return constantTimeEqual(toHex(actual), toHex(expected));
}

// A fixed, valid-format PBKDF2 hash used to run a decoy verify when a login
// email lookup misses, so a failed-login timing side-channel can't reveal
// whether an email is registered. The "password" it corresponds to is
// arbitrary and never used — only the shape (iterations/salt/hash all
// present and well-formed) and the resulting cost matter.
export const DUMMY_PASSWORD_HASH =
  "pbkdf2$100000$dGhpc2lzYWZpeGVkc2FsdHZhbHVl$ZHVtbXlkZXJpdmVka2V5Zm9ydGltaW5nc2FmZXR5MTIzNA==";

export async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(signature);
}

export async function hmacVerify(secret: string, data: string, signatureHex: string): Promise<boolean> {
  const expected = await hmacSign(secret, data);
  return constantTimeEqual(expected, signatureHex);
}

/** Random hex token, suitable for session tokens (32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}
