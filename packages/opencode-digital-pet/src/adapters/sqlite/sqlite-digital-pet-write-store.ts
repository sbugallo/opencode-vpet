import type { SqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-types.ts"
import {
  resolveHostDatabasePath,
  type HostPathOptions,
} from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
import { createSqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"

import { createExecutor, openWritableDatabase } from "./bun-sqlite-driver.ts"
import { readSidebarSnapshotFromExecutor } from "./sqlite-sidebar-snapshot-reader.ts"

export type CreateSqliteDigitalPetRepositoryOptions = HostPathOptions & { readonly databasePath?: string }

export { resolveHostDatabasePath }
export type { HostPathOptions } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
export type {
  PersistedPartnerEvent,
  SqliteDigitalPetWriteStore,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-types.ts"

export type OpencodeSqliteDigitalPetRepository = SqliteDigitalPetWriteStore & SidebarSnapshotReader

export const createSqliteDigitalPetRepository = async (
  options: CreateSqliteDigitalPetRepositoryOptions = {},
): Promise<OpencodeSqliteDigitalPetRepository> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  const database = openWritableDatabase(databasePath)
  const executor = createExecutor(database)

  const writeStore = createSqliteDigitalPetWriteStore({
    databasePath,
    executor,
    close: () => {
      database.close()
    },
  })

  return {
    ...writeStore,
    getSidebarSnapshot: () => readSidebarSnapshotFromExecutor(executor),
  }
}
