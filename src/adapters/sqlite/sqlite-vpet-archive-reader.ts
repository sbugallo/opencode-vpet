import { existsSync } from "node:fs"
import { SQLiteError } from "bun:sqlite"

import type { VpetArchiveEvent, VpetArchivePartner, VpetArchiveResult } from "../../application/models/vpet-archive.ts"
import type { VpetArchiveReader } from "../../application/ports/vpet-archive.ts"
import { resolveHostDatabasePath, type HostPathOptions } from "./app-data-path.ts"
import { createExecutor, openReadonlyDatabase, type SqliteExecutor } from "./bun-sqlite-driver.ts"
import {
  ARCHIVE_PARTNER_EVENTS_SELECT,
  ARCHIVE_PARTNERS_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
} from "./sqlite-vpet-schema.ts"

export type CreateSqliteVpetArchiveReaderOptions = HostPathOptions & { readonly databasePath?: string }

const UNAVAILABLE_ARCHIVE_MESSAGE = "VPet archive is unavailable."

export const isRecoverableSqliteReadError = (error: unknown): error is SQLiteError => {
  return (
    error instanceof SQLiteError &&
    Number.isInteger(error.errno) &&
    (error.code === undefined || error.code.startsWith("SQLITE_"))
  )
}

const toArchiveEvent = (row: PersistedPartnerEventRow): VpetArchiveEvent => ({
  eventId: row.event_id,
  currentNodeId: row.current_node_id,
  createdAt: row.created_at,
})

const toArchivePartner = (row: PersistedPartnerRow, events: readonly VpetArchiveEvent[]): VpetArchivePartner => ({
  partnerId: row.partner_id,
  generation: row.generation,
  createdAt: row.created_at,
  retiredAt: row.retired_at,
  events,
})

const groupEventsByPartnerId = (
  rows: readonly PersistedPartnerEventRow[],
): ReadonlyMap<string, readonly VpetArchiveEvent[]> => {
  const eventsByPartnerId = new Map<string, VpetArchiveEvent[]>()
  for (const row of rows) {
    const events = eventsByPartnerId.get(row.partner_id)
    if (events === undefined) {
      eventsByPartnerId.set(row.partner_id, [toArchiveEvent(row)])
      continue
    }
    events.push(toArchiveEvent(row))
  }
  return eventsByPartnerId
}

export const readSqliteVpetArchive = (executor: Pick<SqliteExecutor, "all">, close: () => void): VpetArchiveResult => {
  try {
    const partners = executor.all<PersistedPartnerRow>(ARCHIVE_PARTNERS_SELECT)
    if (partners.length === 0) return { kind: "empty" }

    const eventsByPartnerId = groupEventsByPartnerId(
      executor.all<PersistedPartnerEventRow>(ARCHIVE_PARTNER_EVENTS_SELECT),
    )
    return {
      kind: "available",
      partners: partners.map((partner) => toArchivePartner(partner, eventsByPartnerId.get(partner.partner_id) ?? [])),
    }
  } catch (error) {
    if (isRecoverableSqliteReadError(error)) return { kind: "unavailable", message: UNAVAILABLE_ARCHIVE_MESSAGE }
    throw error
  } finally {
    close()
  }
}

export const createSqliteVpetArchiveReader = (
  options: CreateSqliteVpetArchiveReaderOptions = {},
): VpetArchiveReader => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)

  return {
    getArchive(): VpetArchiveResult {
      if (!existsSync(databasePath)) return { kind: "empty" }

      try {
        const database = openReadonlyDatabase(databasePath)
        return readSqliteVpetArchive(createExecutor(database), () => database.close())
      } catch (error) {
        if (isRecoverableSqliteReadError(error)) return { kind: "unavailable", message: UNAVAILABLE_ARCHIVE_MESSAGE }
        throw error
      }
    },
  }
}
