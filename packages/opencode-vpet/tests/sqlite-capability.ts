import { Database } from "bun:sqlite"

const MISSING_SQLITE_SHARED_OBJECT = "sqlite3: cannot open shared object file: No such file or directory"

export const isBunSqliteAvailable = (() => {
  try {
    const database = new Database(":memory:")
    database.close()
    return true
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_SQLITE_SHARED_OBJECT) return false
    throw error
  }
})()
