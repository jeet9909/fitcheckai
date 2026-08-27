import { type Env, getState, json } from '../_lib/state';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json<{ choice?: string; note?: string; submit?: boolean }>();

  if (body.choice !== undefined) {
    await env.DB.prepare('UPDATE app_state SET feedback_choice = ? WHERE id = 1').bind(body.choice).run();
  }
  if (body.note !== undefined) {
    await env.DB.prepare('UPDATE app_state SET feedback_note = ? WHERE id = 1').bind(body.note).run();
  }
  if (body.submit) {
    await env.DB.prepare('UPDATE app_state SET feedback_submitted = 1 WHERE id = 1').run();
  }

  return json(await getState(env.DB));
};
