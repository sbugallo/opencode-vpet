import type { SqliteVpetWriteStore } from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-types.ts"
import { resolveHostDatabasePath, type HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
import { createSqliteVpetWriteStore } from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-write-store.ts"
import { openWritableSqlJsDatabase } from "./sqljs-driver.ts"

export type CreateSqliteVpetRepositoryOptions = HostPathOptions & { readonly databasePath?: string }

export { resolveHostDatabasePath }
export type { HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
export type {
  PersistedPartnerEvent,
  SqliteVpetWriteStore,
} from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-types.ts"

export const createSqliteVpetRepository = async (
  options: CreateSqliteVpetRepositoryOptions = {},
): Promise<SqliteVpetWriteStore> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  const database = await openWritableSqlJsDatabase(databasePath)

  return createSqliteVpetWriteStore({
    databasePath,
    executor: database.executor,
    close: () => {
      database.close()
    },
  })
}
