import { createRequire } from "node:module"
import initSqlJs, { type SqlJsStatic } from "sql.js"

declare const __DIGITAL_PET_BUNDLE__: boolean

const require = createRequire(
  typeof __DIGITAL_PET_BUNDLE__ !== "undefined" && __DIGITAL_PET_BUNDLE__ ? __filename : import.meta.url,
)

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
