import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { Database, SqlJsStatic } from "sql.js"

import type { QueryValue, SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"
import { getSqlRuntime } from "./sqljs-config.ts"

export type SqlJsDatabase = {
  readonly executor: SqliteExecutor
  reloadFromDisk(): void
  close(): void
}

const persistDatabase = (database: Database, databasePath: string): void => {
  mkdirSync(dirname(databasePath), { recursive: true })
  writeFileSync(databasePath, Buffer.from(database.export()))
}

const readDatabaseMtimeMs = (databasePath: string): number => {
  if (!existsSync(databasePath)) return 0
  return statSync(databasePath).mtimeMs
}

const loadDatabaseFromDisk = (SQL: SqlJsStatic, databasePath: string): Database => {
  try {
    const buffer = readFileSync(databasePath)
    return new SQL.Database(buffer)
  } catch {
    return new SQL.Database()
  }
}

const configureWriter = (database: Database): void => {
  database.run("PRAGMA foreign_keys = ON")
}

type WritableDatabaseState = {
  database: Database
  lastLocalPersistMs: number
  transactionDepth: number
}

const createWritableExecutor = (
  SQL: SqlJsStatic,
  databasePath: string,
  state: WritableDatabaseState,
): SqliteExecutor => {
  const replaceDatabase = (nextDatabase: Database): void => {
    state.database.close()
    state.database = nextDatabase
    configureWriter(state.database)
  }

  const persist = (): void => {
    persistDatabase(state.database, databasePath)
    state.lastLocalPersistMs = readDatabaseMtimeMs(databasePath)
  }

  const reloadIfStale = (): void => {
    if (state.transactionDepth > 0) return
    const diskMtimeMs = readDatabaseMtimeMs(databasePath)
    if (diskMtimeMs <= state.lastLocalPersistMs) return
    replaceDatabase(loadDatabaseFromDisk(SQL, databasePath))
    state.lastLocalPersistMs = diskMtimeMs
  }

  const persistIfIdle = (): void => {
    if (state.transactionDepth === 0) persist()
  }

  return {
    run(sql, params = []) {
      reloadIfStale()
      state.database.run(sql, Array.from(params))
      persistIfIdle()
    },
    get<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
      reloadIfStale()
      const statement = state.database.prepare(sql)
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
      reloadIfStale()
      const statement = state.database.prepare(sql)
      statement.bind(Array.from(params))
      const rows: TRow[] = []
      while (statement.step()) {
        rows.push(statement.getAsObject() as TRow)
      }
      statement.free()
      return rows
    },
    transaction(operation) {
      reloadIfStale()
      state.database.run("BEGIN IMMEDIATE")
      state.transactionDepth += 1
      try {
        const result = operation()
        state.database.run("COMMIT")
        state.transactionDepth -= 1
        persist()
        return result
      } catch (error) {
        try {
          state.database.run("ROLLBACK")
        } catch {
          // Ignore rollback failures when the transaction is already closed.
        }
        state.transactionDepth -= 1
        throw error
      }
    },
  }
}

const createReadonlyExecutor = (database: Database): SqliteExecutor => {
  return {
    run(sql, params = []) {
      database.run(sql, Array.from(params))
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
      try {
        const result = operation()
        database.run("COMMIT")
        return result
      } catch (error) {
        try {
          database.run("ROLLBACK")
        } catch {
          // Ignore rollback failures when the transaction is already closed.
        }
        throw error
      }
    },
  }
}

const createWritableDatabase = (SQL: SqlJsStatic, databasePath: string): SqlJsDatabase => {
  const state: WritableDatabaseState = {
    database: loadDatabaseFromDisk(SQL, databasePath),
    lastLocalPersistMs: readDatabaseMtimeMs(databasePath),
    transactionDepth: 0,
  }
  configureWriter(state.database)

  const reloadFromDisk = (): void => {
    if (state.transactionDepth > 0) return
    state.database.close()
    state.database = loadDatabaseFromDisk(SQL, databasePath)
    configureWriter(state.database)
    state.lastLocalPersistMs = readDatabaseMtimeMs(databasePath)
  }

  return {
    executor: createWritableExecutor(SQL, databasePath, state),
    reloadFromDisk,
    close() {
      persistDatabase(state.database, databasePath)
      state.lastLocalPersistMs = readDatabaseMtimeMs(databasePath)
      state.database.close()
    },
  }
}

export const openReadonlySqlJsDatabase = async (databasePath: string): Promise<SqlJsDatabase> => {
  const SQL = await getSqlRuntime()
  const database = loadDatabaseFromDisk(SQL, databasePath)
  configureWriter(database)
  return {
    executor: createReadonlyExecutor(database),
    reloadFromDisk() {},
    close() {
      database.close()
    },
  }
}

export const openWritableSqlJsDatabase = async (databasePath: string): Promise<SqlJsDatabase> => {
  const SQL = await getSqlRuntime()
  return createWritableDatabase(SQL, databasePath)
}
