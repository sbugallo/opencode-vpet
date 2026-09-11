import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { Database } from "sql.js"

import type { QueryValue, SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"
import { getSqlRuntime } from "./sqljs-config.ts"

export type SqlJsDatabase = {
  readonly executor: SqliteExecutor
  close(): void
}

const persistDatabase = (database: Database, databasePath: string): void => {
  mkdirSync(dirname(databasePath), { recursive: true })
  writeFileSync(databasePath, Buffer.from(database.export()))
}

const createExecutor = (database: Database, persist: () => void): SqliteExecutor => {
  let transactionDepth = 0

  const persistIfIdle = (): void => {
    if (transactionDepth === 0) persist()
  }

  return {
    run(sql, params = []) {
      database.run(sql, Array.from(params))
      persistIfIdle()
    },
    get<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
      const statement = database.prepare(sql)
      statement.bind(Array.from(params))
      if (!statement.step()) {
        statement.free()
        return null
      }
      const row = statement.getAsObject() as TRow
      statement.free()
      return row
    },
    all<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
      const statement = database.prepare(sql)
      statement.bind(Array.from(params))
      const rows: TRow[] = []
      while (statement.step()) {
        rows.push(statement.getAsObject() as TRow)
      }
      statement.free()
      return rows
    },
    transaction(operation) {
      database.run("BEGIN IMMEDIATE")
      transactionDepth += 1
      try {
        const result = operation()
        database.run("COMMIT")
        transactionDepth -= 1
        persist()
        return result
      } catch (error) {
        try {
          database.run("ROLLBACK")
        } catch {
          // Ignore rollback failures when the transaction is already closed.
        }
        transactionDepth -= 1
        throw error
      }
    },
  }
}

const configureWriter = (database: Database): void => {
  database.run("PRAGMA foreign_keys = ON")
}

export const openReadonlySqlJsDatabase = async (databasePath: string): Promise<SqlJsDatabase> => {
  const SQL = await getSqlRuntime()
  const buffer = readFileSync(databasePath)
  const database = new SQL.Database(buffer)
  configureWriter(database)
  return {
    executor: createExecutor(database, () => {}),
    close() {
      database.close()
    },
  }
}

export const openWritableSqlJsDatabase = async (databasePath: string): Promise<SqlJsDatabase> => {
  const SQL = await getSqlRuntime()
  let database: Database
  try {
    const buffer = readFileSync(databasePath)
    database = new SQL.Database(buffer)
  } catch {
    database = new SQL.Database()
  }
  configureWriter(database)
  const persist = () => persistDatabase(database, databasePath)
  return {
    executor: createExecutor(database, persist),
    close() {
      persist()
      database.close()
    },
  }
}
