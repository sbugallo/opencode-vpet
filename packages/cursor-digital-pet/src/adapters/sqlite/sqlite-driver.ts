import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

import type { QueryValue, SqliteExecutor } from "@jcendal/digital-pet-core/ports/sqlite-executor.ts"

type SqliteValue = string | number | null

type Statement = {
  run(...params: SqliteValue[]): unknown
  get(...params: SqliteValue[]): unknown
  all(...params: SqliteValue[]): unknown[]
}

type Connection = {
  exec(sql: string): void
  prepare(sql: string): Statement
  close(): void
}

type BunDatabaseConstructor = new (
  path: string,
  options: { readonly create: boolean; readonly readonly: boolean },
) => {
  run(sql: string): unknown
  query(sql: string): Statement
  close(): void
}

export type SqliteDatabase = {
  readonly executor: SqliteExecutor
  reloadFromDisk(): void
  close(): void
}

const toSqliteValue = (value: QueryValue): SqliteValue => (typeof value === "boolean" ? Number(value) : value)

const openConnection = (databasePath: string, readonly: boolean): Connection => {
  if ("bun" in process.versions) {
    const { Database } = require("bun:sqlite") as { Database: BunDatabaseConstructor }
    const database = new Database(databasePath, { create: !readonly, readonly })
    return {
      exec: (sql) => {
        database.run(sql)
      },
      prepare: (sql) => database.query(sql),
      close: () => database.close(),
    }
  }

  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite")
  const database = new DatabaseSync(databasePath, { readOnly: readonly })
  return {
    exec: (sql) => database.exec(sql),
    prepare: (sql) => database.prepare(sql),
    close: () => database.close(),
  }
}

const createExecutor = (database: Connection): SqliteExecutor => ({
  run(sql, params = []) {
    database.prepare(sql).run(...params.map(toSqliteValue))
  },
  get<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
    return (database.prepare(sql).get(...params.map(toSqliteValue)) as TRow | undefined) ?? null
  },
  all<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
    return database.prepare(sql).all(...params.map(toSqliteValue)) as TRow[]
  },
  transaction(operation) {
    database.exec("BEGIN IMMEDIATE")
    try {
      const result = operation()
      database.exec("COMMIT")
      return result
    } catch (error) {
      try {
        database.exec("ROLLBACK")
      } catch {
        // Preserve the original failure if SQLite already closed the transaction.
      }
      throw error
    }
  },
})

export const openReadonlySqliteDatabase = (databasePath: string): SqliteDatabase => {
  const database = openConnection(databasePath, true)
  database.exec("PRAGMA busy_timeout = 5000")
  return {
    executor: createExecutor(database),
    reloadFromDisk() {},
    close: () => database.close(),
  }
}

export const openWritableSqliteDatabase = (databasePath: string): SqliteDatabase => {
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = openConnection(databasePath, false)
  database.exec("PRAGMA busy_timeout = 5000")
  database.exec("PRAGMA journal_mode = WAL")
  database.exec("PRAGMA foreign_keys = ON")
  return {
    executor: createExecutor(database),
    // A file-backed SQLite connection sees committed writes from other processes.
    reloadFromDisk() {},
    close: () => database.close(),
  }
}
