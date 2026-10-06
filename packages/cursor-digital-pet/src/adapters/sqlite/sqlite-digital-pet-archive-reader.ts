import { existsSync } from "node:fs"

import {
  ARCHIVE_PARTNER_EVENTS_SELECT,
  ARCHIVE_PARTNERS_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-schema.ts"
import type {
  DigitalPetArchiveEvent,
  DigitalPetArchivePartner,
  DigitalPetArchiveResult,
} from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { DigitalPetArchiveReader } from "@jcendal/digital-pet-core/application/ports/digital-pet-archive.ts"
import type { SqliteExecutor } from "@jcendal/digital-pet-core/ports/sqlite-executor.ts"

import { UNAVAILABLE_ARCHIVE_MESSAGE } from "../../shared/constants/sqlite.ts"
import { isRecoverableSqliteReadError } from "./errors.ts"
import { resolveDatabasePath, type SqliteDatabaseOptions } from "./options.ts"
import { openReadonlySqliteDatabase } from "./sqlite-driver.ts"

export type CreateSqliteDigitalPetArchiveReaderOptions = SqliteDatabaseOptions

const toArchiveEvent = (row: PersistedPartnerEventRow): DigitalPetArchiveEvent => ({
  eventId: row.event_id,
  currentNodeId: row.current_node_id,
  createdAt: row.created_at,
})

const toArchivePartner = (
  row: PersistedPartnerRow,
  events: readonly DigitalPetArchiveEvent[],
): DigitalPetArchivePartner => ({
  partnerId: row.partner_id,
  generation: row.generation,
  createdAt: row.created_at,
  retiredAt: row.retired_at,
  events,
})

const groupEventsByPartnerId = (
  rows: readonly PersistedPartnerEventRow[],
): ReadonlyMap<string, readonly DigitalPetArchiveEvent[]> => {
  const eventsByPartnerId = new Map<string, DigitalPetArchiveEvent[]>()
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

export const readSqliteDigitalPetArchive = (executor: Pick<SqliteExecutor, "all">): DigitalPetArchiveResult => {
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

export const createSqliteDigitalPetArchiveReader = async (
  options: CreateSqliteDigitalPetArchiveReaderOptions = {},
): Promise<DigitalPetArchiveReader> => {
  const databasePath = resolveDatabasePath(options)
  return {
    getArchive(): DigitalPetArchiveResult {
      return readArchiveAtPath(databasePath)
    },
  }
}

const readArchiveAtPath = (databasePath: string): DigitalPetArchiveResult => {
  if (!existsSync(databasePath)) return { kind: "empty" }

  try {
    const database = openReadonlySqliteDatabase(databasePath)
    try {
      return readSqliteDigitalPetArchive(database.executor)
    } finally {
      database.close()
    }
  } catch (error) {
    if (isRecoverableSqliteReadError(error)) return { kind: "unavailable", message: UNAVAILABLE_ARCHIVE_MESSAGE }
    throw error
  }
}

export const readArchive = async (
  options: CreateSqliteDigitalPetArchiveReaderOptions = {},
): Promise<DigitalPetArchiveResult> => readArchiveAtPath(resolveDatabasePath(options))
