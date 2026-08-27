import { type Env, getState, json } from '../_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  await env.DB.prepare('UPDATE app_state SET profile_setup_done = 1 WHERE id = 1').run();
  return json(await getState(env.DB));
};
