/**
 * TEMPORARY client-side render-quota gate.
 *
 * Per the redesign plan (see /ux/redesign/06-monetisation), the free tier is
 * 2 renders on the user's own photo, lifetime, then a paywall sheet fires.
 * This should move server-side (e.g. `renderCount`/`plan` fields on ApiState
 * in lib/api.ts + a Cloudflare Function) the moment payments are wired up —
 * a client-only counter is trivially resettable and must not be trusted for
 * anything billing-related. It exists only so the UI/paywall flow can be
 * built and demoed before that backend work lands.
 */

const KEY = 'fitcart_free_renders_used';
export const FREE_RENDER_LIMIT = 2;

export function getRendersUsed(): number {
  const raw = window.localStorage.getItem(KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export function recordRenderUsed(): number {
  const next = getRendersUsed() + 1;
  window.localStorage.setItem(KEY, String(next));
  return next;
}

export function hasFreeRendersLeft(): boolean {
  return getRendersUsed() < FREE_RENDER_LIMIT;
}

export function rendersRemaining(): number {
  return Math.max(0, FREE_RENDER_LIMIT - getRendersUsed());
}
