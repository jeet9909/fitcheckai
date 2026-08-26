// Same-origin check for mutating requests. Combined with the SameSite=Lax
// session cookie set by session.ts, this is the full CSRF defense for this
// JSON API (no double-submit token needed) — see BRIEF.md's security
// constraints. Rejects if the Origin header is missing or doesn't match the
// request's own origin; browsers reliably send Origin on same-origin
// fetch()-driven POSTs, so requiring it (rather than falling back to Referer)
// is the safer default here.

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return requestUrl.protocol === originUrl.protocol && requestUrl.host === originUrl.host;
  } catch {
    return false;
  }
}
