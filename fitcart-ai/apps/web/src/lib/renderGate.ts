import { supabase } from './supabase';

/**
 * Client-side render-quota gate. Per the redesign plan, the free tier is 2
 * renders on the user's own photo, lifetime, then a paywall sheet fires.
 * Demo-body renders are unlimited and never count here.
 *
 * The localStorage counter below is the ONLY source of truth for anonymous
 * visitors (the spec explicitly allows 2 free renders before any signup),
 * so it stays. When a user IS signed in, recordRenderUsed() also does a
 * best-effort write to the render_usage table (RLS-scoped to their own
 * rows) so usage is visible cross-device later — this does not replace the
 * localStorage count, it supplements it.
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

  const client = supabase;
  if (client) {
    client.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      client.from('render_usage').insert({ user_id: user.id, is_demo_body: false }).then(() => {});
    });
  }

  return next;
}

export function hasFreeRendersLeft(): boolean {
  return getRendersUsed() < FREE_RENDER_LIMIT;
}

export function rendersRemaining(): number {
  return Math.max(0, FREE_RENDER_LIMIT - getRendersUsed());
}
