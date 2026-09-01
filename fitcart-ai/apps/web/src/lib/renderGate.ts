/**
 * Client-side render-quota hint. The real enforcement is server-side now —
 * create-render (Supabase Edge Function) checks render_usage/subscriptions
 * itself and returns 402 once a caller is actually out of renders (see
 * src/lib/tryon.ts's QuotaExceededError) — so this localStorage counter is
 * just a fast, offline-friendly pre-check to skip an obviously-wasted round
 * trip and show the paywall immediately. It is NOT the source of truth: a
 * cleared localStorage no longer grants extra renders, since the server
 * re-checks render_usage (keyed by the real auth.uid(), anonymous or not)
 * regardless of what this counter says.
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
