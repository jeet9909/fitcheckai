import { type Env, json, rowToProduct } from '../_lib/state';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = Number(params.id);
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Product not found' }, { status: 404 });
  return json(rowToProduct(row as never));
};
