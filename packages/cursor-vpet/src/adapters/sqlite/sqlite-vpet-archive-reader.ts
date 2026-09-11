import { existsSync } from "node:fs"

import type {
  VpetArchiveEvent,
  VpetArchivePartner,
  VpetArchiveResult,
} from "@sbugallo/vpet-core/application/models/vpet-archive.ts"
import type { VpetArchiveReader } from "@sbugallo/vpet-core/application/ports/vpet-archive.ts"
import type { SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"
import { resolveHostDatabasePath, type HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
import { openReadonlySqlJsDatabase } from "./sqljs-driver.ts"
import {
  ARCHIVE_PARTNER_EVENTS_SELECT,
  ARCHIVE_PARTNERS_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
} from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-schema.ts"

export type CreateSqliteVpetArchiveReaderOptions = HostPathOptions & { readonly databasePath?: string }

const UNAVAILABLE_ARCHIVE_MESSAGE = "VPet archive is unavailable."

const isRecoverableSqliteReadError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("sqlite") || error.message.includes("database") || error.message.includes("no such table"))

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

export const readSqliteVpetArchive = (executor: Pick<SqliteExecutor, "all">): VpetArchiveResult => {
  const partners = executor.all<PersistedPartnerRow>(ARCHIVE_PARTNERS_SELECT)
  if (partners.length === 0) return { kind: "empty" }

  const eventsByPartnerId = groupEventsByPartnerId(
    executor.all<PersistedPartnerEventRow>(ARCHIVE_PARTNER_EVENTS_SELECT),
  )
  return {
    kind: "available",
    partners: partners.map((partner) => toArchivePartner(partner, eventsByPartnerId.get(partner.partner_id) ?? [])),
  }
}

export const createSqliteVpetArchiveReader = async (
  options: CreateSqliteVpetArchiveReaderOptions = {},
): Promise<VpetArchiveReader> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  if (!existsSync(databasePath)) {
    return { getArchive: () => ({ kind: "empty" }) }
  }

  const database = await openReadonlySqlJsDatabase(databasePath)
  return {
    getArchive(): VpetArchiveResult {
      try {
        return readSqliteVpetArchive(database.executor)
      } catch (error) {
        if (isRecoverableSqliteReadError(error)) return { kind: "unavailable", message: UNAVAILABLE_ARCHIVE_MESSAGE }
        throw error
      }
    },
  }
}

export const readArchive = async (options: CreateSqliteVpetArchiveReaderOptions = {}): Promise<VpetArchiveResult> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  if (!existsSync(databasePath)) return { kind: "empty" }

  try {
    const database = await openReadonlySqlJsDatabase(databasePath)
    try {
      return readSqliteVpetArchive(database.executor)
    } finally {
      database.close()
    }
  } catch (error) {
    if (isRecoverableSqliteReadError(error)) return { kind: "unavailable", message: UNAVAILABLE_ARCHIVE_MESSAGE }
    throw error
  }
}
