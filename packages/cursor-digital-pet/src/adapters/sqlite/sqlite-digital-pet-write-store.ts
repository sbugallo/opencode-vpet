import type { SqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-types.ts"
import { createSqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"

import { resolveDatabasePath, type SqliteDatabaseOptions } from "./options.ts"
import { readSidebarSnapshotFromExecutor } from "./sqlite-sidebar-snapshot-reader.ts"
import { openWritableSqliteDatabase } from "./sqlite-driver.ts"

export type CreateSqliteDigitalPetRepositoryOptions = SqliteDatabaseOptions

export { resolveHostDatabasePath } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
export { resolveDatabasePath } from "./options.ts"
export type { HostPathOptions } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
export type {
  PersistedPartnerEvent,
  SqliteDigitalPetWriteStore,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-types.ts"

export type CursorSqliteDigitalPetRepository = SqliteDigitalPetWriteStore &
  SidebarSnapshotReader & {
    reloadFromDisk(): void
  }

export const createSqliteDigitalPetRepository = async (
  options: CreateSqliteDigitalPetRepositoryOptions = {},
): Promise<CursorSqliteDigitalPetRepository> => {
  const databasePath = resolveDatabasePath(options)
  const database = openWritableSqliteDatabase(databasePath)

  const writeStore = createSqliteDigitalPetWriteStore({
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
