import { type Env, getAllProducts, json } from '../_lib/state';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const bucket = url.searchParams.get('bucket');
  const store = url.searchParams.get('store');
  const q = url.searchParams.get('q')?.trim().toLowerCase();

  let products = await getAllProducts(env.DB);

  if (bucket && bucket !== 'All') products = products.filter((p) => p.bucket === bucket);
  if (store && store !== 'All') products = products.filter((p) => p.store === store);
  if (q) products = products.filter((p) => (p.name + ' ' + p.brand + ' ' + p.category).toLowerCase().includes(q));

  return json(products);
};
