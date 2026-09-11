declare module "sql.js" {
  export type SqlJsStatic = {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export type Database = {
    run(sql: string, params?: readonly (string | number | boolean | null)[]): void
    prepare(sql: string): Statement
    exec(sql: string, params?: readonly (string | number | boolean | null)[]): QueryExecResult[]
    export(): Uint8Array
    close(): void
  }

  export type QueryExecResult = {
    columns: string[]
    values: unknown[][]
  }

  export type Statement = {
    bind(values?: readonly (string | number | boolean | null)[]): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): void
  }

  export type InitSqlJsConfig = {
    readonly locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}
