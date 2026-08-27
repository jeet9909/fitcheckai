import { type Env, getState, json } from '../_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  await env.DB.prepare("UPDATE app_state SET feedback_choice = NULL, feedback_note = '', feedback_submitted = 0 WHERE id = 1").run();
  return json(await getState(env.DB));
};
