// Thin parameterized D1 wrapper. Every query goes through
// `.prepare(sql).bind(...args)` — callers must never string-concatenate user
// input into a SQL string, only ever pass it as a bind argument.

export async function dbRun(db: D1Database, sql: string, ...args: unknown[]): Promise<D1Result> {
  return db
    .prepare(sql)
    .bind(...args)
    .run();
}

export async function dbFirst<T = Record<string, unknown>>(db: D1Database, sql: string, ...args: unknown[]): Promise<T | null> {
  const row = await db
    .prepare(sql)
    .bind(...args)
    .first<T>();
  return row ?? null;
}

export async function dbAll<T = Record<string, unknown>>(db: D1Database, sql: string, ...args: unknown[]): Promise<T[]> {
  const result = await db
    .prepare(sql)
    .bind(...args)
    .all<T>();
  return result.results ?? [];
}
