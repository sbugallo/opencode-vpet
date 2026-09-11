import { createRequire } from "node:module"
import initSqlJs, { type SqlJsStatic } from "sql.js"

const require = createRequire(import.meta.url)

let sqlRuntime: SqlJsStatic | undefined
let wasmPath: string | undefined

export const configureSqlJsWasmPath = (path: string): void => {
  wasmPath = path
}

const resolveWasmPath = (): string => {
  if (wasmPath !== undefined) return wasmPath
  return require.resolve("sql.js/dist/sql-wasm.wasm")
}

export const getSqlRuntime = async (): Promise<SqlJsStatic> => {
  if (sqlRuntime === undefined) {
    sqlRuntime = await initSqlJs({
      locateFile: () => resolveWasmPath(),
    })
  }
  return sqlRuntime
}
