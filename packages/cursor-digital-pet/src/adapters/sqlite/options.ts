import {
  resolveHostDatabasePath,
  type HostPathOptions,
} from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"

export type SqliteDatabaseOptions = HostPathOptions & {
  readonly databasePath?: string
}

export const resolveDatabasePath = (options: SqliteDatabaseOptions = {}): string =>
  options.databasePath ?? resolveHostDatabasePath(options)
