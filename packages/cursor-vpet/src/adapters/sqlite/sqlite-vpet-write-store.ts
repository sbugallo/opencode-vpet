import type { SqliteVpetWriteStore } from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-types.ts"
import { createSqliteVpetWriteStore } from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-write-store.ts"
import type { SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"

import { resolveDatabasePath, type SqliteDatabaseOptions } from "./options.ts"
import { readSidebarSnapshotFromExecutor } from "./sqlite-sidebar-snapshot-reader.ts"
import { openWritableSqlJsDatabase } from "./sqljs-driver.ts"

export type CreateSqliteVpetRepositoryOptions = SqliteDatabaseOptions

export { resolveHostDatabasePath } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
export { resolveDatabasePath } from "./options.ts"
export type { HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
export type {
  PersistedPartnerEvent,
  SqliteVpetWriteStore,
} from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-types.ts"

export type CursorSqliteVpetRepository = SqliteVpetWriteStore &
  SidebarSnapshotReader & {
    reloadFromDisk(): void
  }

export const createSqliteVpetRepository = async (
  options: CreateSqliteVpetRepositoryOptions = {},
): Promise<CursorSqliteVpetRepository> => {
  const databasePath = resolveDatabasePath(options)
  const database = await openWritableSqlJsDatabase(databasePath)

  const writeStore = createSqliteVpetWriteStore({
    databasePath,
    executor: database.executor,
    close: () => {
      database.close()
    },
  })

  return {
    ...writeStore,
    getSidebarSnapshot: () => readSidebarSnapshotFromExecutor(database.executor),
    reloadFromDisk: () => {
      database.reloadFromDisk()
    },
  }
}
