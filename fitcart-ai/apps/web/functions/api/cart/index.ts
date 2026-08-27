import { type Env, getState, json } from '../_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { productId } = await request.json<{ productId: number }>();

  const existing = await env.DB.prepare('SELECT id FROM cart_items WHERE product_id = ?').bind(productId).first();
  if (!existing) {
    await env.DB.prepare('INSERT INTO cart_items (product_id, qty) VALUES (?, 1)').bind(productId).run();
  }

  return json(await getState(env.DB));
};
