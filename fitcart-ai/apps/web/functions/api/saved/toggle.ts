import { type Env, getState, json } from '../_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { productId } = await request.json<{ productId: number }>();

  const existing = await env.DB.prepare('SELECT product_id FROM saved_products WHERE product_id = ?').bind(productId).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM saved_products WHERE product_id = ?').bind(productId).run();
  } else {
    await env.DB.prepare('INSERT INTO saved_products (product_id) VALUES (?)').bind(productId).run();
  }

  return json(await getState(env.DB));
};
