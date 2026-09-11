import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { Database } from "bun:sqlite"

import type { QueryValue, SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"

export type { QueryValue, SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"

export const createExecutor = (database: Database): SqliteExecutor => ({
  run(sql, params = []) {
    database.run(sql, Array.from(params))
  },
  get<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
    return database.query<TRow, QueryValue[]>(sql).get(...Array.from(params)) ?? null
  },
  all<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
    return database.query<TRow, QueryValue[]>(sql).all(...Array.from(params))
  },
  transaction(operation) {
    return database.transaction(operation).immediate()
  },
})

const configureWriter = (database: Database): void => {
  database.run("PRAGMA busy_timeout = 5000")
  database.run("PRAGMA journal_mode = WAL")
  database.run("PRAGMA foreign_keys = ON")
}

const configureReader = (database: Database): void => {
  database.run("PRAGMA busy_timeout = 5000")
  database.run("PRAGMA foreign_keys = ON")
}

export const openWritableDatabase = (databasePath: string): Database => {
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = new Database(databasePath, { create: true, readwrite: true })
  configureWriter(database)
  return database
}

export const openReadonlyDatabase = (databasePath: string): Database => {
  const database = new Database(databasePath, { readonly: true })
  configureReader(database)
  return database
}
