import { type Env, getState, json } from './_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { tier } = await request.json<{ tier: string }>();
  await env.DB.prepare('UPDATE app_state SET tier = ? WHERE id = 1').bind(tier).run();
  return json(await getState(env.DB));
};
