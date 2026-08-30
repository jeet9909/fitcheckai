import { supabase } from './supabase';

export interface RegionRow {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'ok';
}

export interface RenderRow {
  id: number;
  product_id: number | null;
  body_profile_id: number;
  status: 'done' | 'failed';
  render_image_url: string | null;
  size_recommended: string | null;
  headline: string | null;
  detail: string | null;
  region_breakdown: RegionRow[] | null;
  confidence: number | null;
  error: string | null;
}

export type ProcessingResult =
  | { kind: 'done'; render: RenderRow }
  | { kind: 'quota_exceeded' }
  | { kind: 'error'; message: string };

export class QuotaExceededError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'QuotaExceededError';
  }
}

// Calls the create-render Edge Function — the real backend for the
// Setup -> Processing -> Result flow. Throws QuotaExceededError on the
// server's 402 (out of free/plan renders) so callers can route straight to
// the paywall instead of showing a generic failure.
//
// supabase-js surfaces a non-2xx Edge Function response as `error` (a
// FunctionsHttpError) with `data: null` — the response body is only
// available via `error.context`, a raw, unconsumed Response.
export async function startRender(bodyProfileId: number, productId: number | null): Promise<RenderRow> {
  if (!supabase) throw new Error('Backend not configured');

  const { data, error } = await supabase.functions.invoke<{ render?: RenderRow; error?: string }>('create-render', {
    body: { bodyProfileId, productId },
  });

  if (error) {
    const context = (error as unknown as { context?: Response }).context;
    const body = await context?.json().catch(() => null) as { error?: string } | null;
    if (context?.status === 402) {
      throw new QuotaExceededError(body?.error ?? 'quota_exceeded');
    }
    throw new Error(body?.error ?? error.message);
  }
  if (!data?.render) {
    throw new Error('Render failed');
  }

  return data.render;
}
