import { type Env, getState, json } from '../_lib/state';

export const onRequestDelete: PagesFunction<Env> = async ({ env }) => {
  await env.DB.prepare('UPDATE app_state SET profile_setup_done = 0, consent_photos = 0, consent_sharing = 0 WHERE id = 1').run();
  return json(await getState(env.DB));
};
