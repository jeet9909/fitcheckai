import { type Env, getState, json } from './_lib/state';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json(await getState(env.DB));
};
