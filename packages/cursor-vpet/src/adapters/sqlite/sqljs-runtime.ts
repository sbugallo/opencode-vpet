import { readFileSync } from "node:fs"
import type { Database } from "sql.js"

import { getSqlRuntime } from "./sqljs-config.ts"

export { configureSqlJsWasmPath } from "./sqljs-config.ts"

export const openDatabaseFromPath = async (databasePath: string): Promise<Database> => {
  const SQL = await getSqlRuntime()
  try {
    return new SQL.Database(readFileSync(databasePath))
  } catch {
    return new SQL.Database()
  }
}
