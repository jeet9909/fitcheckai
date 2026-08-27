import { type Env, getState, json } from './_lib/state';

const VALID_SLOTS = new Set(['top', 'bottom', 'shoes', 'watch', 'accessory']);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { slot, productId } = await request.json<{ slot: string; productId: number | null }>();
  if (!VALID_SLOTS.has(slot)) return json({ error: 'Invalid slot' }, { status: 400 });

  await env.DB.prepare('INSERT INTO outfit_slots (slot, product_id) VALUES (?, ?) ON CONFLICT(slot) DO UPDATE SET product_id = excluded.product_id')
    .bind(slot, productId ?? null)
    .run();

  return json(await getState(env.DB));
};
