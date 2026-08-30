// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy create-render
// Requires secrets: SUPABASE_URL (auto-provided), SUPABASE_SERVICE_ROLE_KEY.
// Optional secret: FAL_API_KEY (see tryon.ts — omitted, falls back to a mock
// passthrough render so the pipeline works without a paid key).
//
// This is the real backend for the Setup -> Processing -> Result flow,
// which previously had none: Processing was a setInterval animation and
// Result showed a hardcoded verdict. Runs synchronously (single request/
// response) rather than a queue+poll design — there's no worker
// infrastructure here, and the mock/fal.ai calls are fast enough for a
// direct request. If a future provider is too slow for that, this is the
// seam to split into an enqueue + poll pair.
//
// Accepts a Supabase JWT for either a signed-in user OR an anonymous
// session (see src/state/AuthState.tsx) — both have a real auth.uid(),
// which is what lets the free-render quota and RLS apply uniformly to
// guests and members.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTryOnProvider } from './tryon.ts';
import { computeVerdict } from './verdict.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_RENDER_LIMIT = 2;
const DAY_PASS_LIMIT = 10;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function checkQuota(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, current_period_end, created_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  const now = Date.now();
  const activePro = (subs ?? []).find((s) => (s.plan === 'pro' || s.plan === 'year')
    && (!s.current_period_end || new Date(s.current_period_end).getTime() > now));
  if (activePro) return { allowed: true };

  const activeDay = (subs ?? []).find((s) => s.plan === 'day'
    && s.current_period_end && new Date(s.current_period_end).getTime() > now);
  if (activeDay) {
    const { count } = await supabaseAdmin
      .from('render_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('rendered_at', activeDay.created_at);
    if ((count ?? 0) < DAY_PASS_LIMIT) return { allowed: true };
    return { allowed: false, reason: 'day_pass_limit_reached' };
  }

  const { count: freeCount } = await supabaseAdmin
    .from('render_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_demo_body', false);
  if ((freeCount ?? 0) < FREE_RENDER_LIMIT) return { allowed: true };

  return { allowed: false, reason: 'quota_exceeded' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return json({ error: 'Not authenticated' }, 401);
    }
    const userId = userData.user.id;

    const { productId, bodyProfileId } = await req.json();
    if (typeof bodyProfileId !== 'number') {
      return json({ error: 'Missing bodyProfileId' }, 400);
    }

    const { data: bodyProfile, error: bpError } = await supabaseAdmin
      .from('body_profiles')
      .select('*')
      .eq('id', bodyProfileId)
      .single();
    if (bpError || !bodyProfile || bodyProfile.user_id !== userId) {
      return json({ error: 'Body profile not found' }, 404);
    }

    let product: { id: number; name: string; image_url: string | null; fit_score: number; confidence: number } | null = null;
    if (typeof productId === 'number') {
      const { data } = await supabaseAdmin
        .from('products')
        .select('id, name, image_url, fit_score, confidence')
        .eq('id', productId)
        .single();
      product = data;
    }

    const quota = await checkQuota(userId);
    if (!quota.allowed) {
      return json({ error: quota.reason ?? 'quota_exceeded' }, 402);
    }

    const { data: signedPhoto, error: signError } = await supabaseAdmin
      .storage
      .from('user-photos')
      .createSignedUrl(bodyProfile.photo_path, 300);
    if (signError || !signedPhoto) {
      return json({ error: 'Could not read uploaded photo' }, 500);
    }

    let renderRow: Record<string, unknown>;
    try {
      const provider = getTryOnProvider();
      const result = await provider.render(signedPhoto.signedUrl, product?.image_url ?? null);

      const verdict = computeVerdict({
        garmentName: product?.name ?? 'this garment',
        fitScore: product?.fit_score ?? 80,
        confidence: product?.confidence ?? 75,
        heightCm: bodyProfile.height_cm,
        weightKg: bodyProfile.weight_kg,
      });

      renderRow = {
        user_id: userId,
        product_id: product?.id ?? null,
        body_profile_id: bodyProfileId,
        status: 'done',
        render_image_url: result.imageUrl,
        size_recommended: verdict.size,
        headline: verdict.headline,
        detail: verdict.detail,
        region_breakdown: verdict.regionBreakdown,
        confidence: verdict.confidence,
      };
    } catch (err) {
      renderRow = {
        user_id: userId,
        product_id: product?.id ?? null,
        body_profile_id: bodyProfileId,
        status: 'failed',
        error: String(err),
      };
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('renders')
      .insert(renderRow)
      .select()
      .single();
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    if (inserted.status === 'done') {
      await supabaseAdmin.from('render_usage').insert({ user_id: userId, is_demo_body: false });
    }

    if (inserted.status === 'failed') {
      return json({ error: inserted.error ?? 'Render failed', render: inserted }, 502);
    }

    return json({ render: inserted });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
