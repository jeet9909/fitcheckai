import { type Env, getState, json } from './_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { key } = await request.json<{ key: 'photos' | 'sharing' }>();
  const column = key === 'photos' ? 'consent_photos' : 'consent_sharing';

  await env.DB.prepare(`UPDATE app_state SET ${column} = 1 - ${column} WHERE id = 1`).run();

  return json(await getState(env.DB));
};
