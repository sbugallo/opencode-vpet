export type QueryValue = string | number | boolean | null

export type SqliteExecutor = {
  run: (sql: string, params?: readonly QueryValue[]) => void
  get: <TRow extends Record<string, QueryValue>>(sql: string, params?: readonly QueryValue[]) => TRow | null
  all: <TRow extends Record<string, QueryValue>>(sql: string, params?: readonly QueryValue[]) => readonly TRow[]
  transaction: <TReturn>(operation: () => TReturn) => TReturn
}
