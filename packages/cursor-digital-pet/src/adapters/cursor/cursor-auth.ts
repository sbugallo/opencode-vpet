import { readFileSync } from "node:fs"
import type { Database } from "sql.js"

import { CURSOR_ACCESS_TOKEN_KEY } from "../../shared/constants/cursor.ts"
import { getSqlRuntime } from "../sqlite/sqljs-config.ts"
import { resolveStateVscdbPath } from "./paths.ts"

const queryItemTable = (database: Database, key: string): string | null => {
  const statement = database.prepare("SELECT value FROM ItemTable WHERE key = ?")
  statement.bind([key])
  if (!statement.step()) {
    statement.free()
    return null
  }
  const row = statement.getAsObject() as { value?: unknown }
  statement.free()
  const cell = row.value
  if (cell === null || cell === undefined) return null
  return typeof cell === "string" ? cell : String(cell)
}

export const readCursorAccessToken = async (): Promise<string | null> => {
  const statePath = resolveStateVscdbPath()
  try {
    const SQL = await getSqlRuntime()
    const buffer = readFileSync(statePath)
    const database = new SQL.Database(buffer)
    try {
      return queryItemTable(database, CURSOR_ACCESS_TOKEN_KEY)
    } finally {
      database.close()
    }
  } catch {
    return null
  }
}
