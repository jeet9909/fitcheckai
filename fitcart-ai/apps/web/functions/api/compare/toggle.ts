import { type Env, getState, json } from '../_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { productId } = await request.json<{ productId: number }>();

  const existing = await env.DB.prepare('SELECT product_id FROM compare_items WHERE product_id = ?').bind(productId).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM compare_items WHERE product_id = ?').bind(productId).run();
  } else {
    const { results } = await env.DB.prepare('SELECT COUNT(*) as n FROM compare_items').all<{ n: number }>();
    const count = results?.[0]?.n ?? 0;
    if (count >= 3) {
      const state = await getState(env.DB);
      return json({ ...state, error: 'Compare up to 3 items at a time' });
    }
    await env.DB.prepare('INSERT INTO compare_items (product_id) VALUES (?)').bind(productId).run();
  }

  return json(await getState(env.DB));
};
