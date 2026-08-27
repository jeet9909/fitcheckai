import { type Env, getState, json } from '../_lib/state';

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  const productId = Number(params.productId);
  await env.DB.prepare('DELETE FROM cart_items WHERE product_id = ?').bind(productId).run();
  return json(await getState(env.DB));
};
