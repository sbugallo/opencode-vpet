import { existsSync } from "node:fs"

import type { SidebarSnapshot, SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import { resolveHostDatabasePath, type HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
import type { SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"
import { openDatabaseFromPath } from "./sqljs-runtime.ts"
import { openReadonlySqlJsDatabase } from "./sqljs-driver.ts"
import {
  ACTIVE_PARTNER_SELECT,
  toPartner,
  type PersistedPartnerRow,
  type TrainerStateRow,
} from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-schema.ts"

export type CreateSqliteSidebarSnapshotReaderOptions = HostPathOptions & { readonly databasePath?: string }

const TRAINER_STATE_SELECT = "SELECT total_tokens FROM trainer_state WHERE trainer_id = 1"
const CONTROL_STATE_SELECT = "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1"

type ControlStateRow = {
  readonly frozen: number
  readonly cheat_node_id: string | null
}

const isRecoverableSqliteReadError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("sqlite") || error.message.includes("database") || error.message.includes("no such table"))

export const readSidebarSnapshotFromExecutor = (
  executor: Pick<SqliteExecutor, "get">,
): SidebarSnapshot | null => {
  const trainer = executor.get<TrainerStateRow>(TRAINER_STATE_SELECT)
  const control = executor.get<ControlStateRow>(CONTROL_STATE_SELECT)
  if (control?.cheat_node_id !== null && control?.cheat_node_id !== undefined) {
    return {
      currentNodeId: control.cheat_node_id,
      gauge: 0,
      isTerminal: true,
      frozen: false,
      isSetOverride: true,
      trainerTotalTokens: trainer?.total_tokens ?? 0,
    }
  }

  const partnerRow = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
  if (partnerRow === null) return null

  const partner = toPartner(partnerRow)
  return {
    currentNodeId: partner.currentNodeId,
    gauge: partner.gauge,
    isTerminal: partner.isTerminal,
    frozen: control?.frozen === 1,
    isSetOverride: false,
    trainerTotalTokens: trainer?.total_tokens ?? 0,
  }
}

export const createSqliteSidebarSnapshotReader = async (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): Promise<SidebarSnapshotReader> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  if (!existsSync(databasePath)) {
    return { getSidebarSnapshot: () => null }
  }

  const database = await openReadonlySqlJsDatabase(databasePath)
  return {
    getSidebarSnapshot(): SidebarSnapshot | null {
      try {
        return readSidebarSnapshotFromExecutor(database.executor)
      } catch (error) {
        if (isRecoverableSqliteReadError(error)) return null
        throw error
      }
    },
  }
}

export const readSidebarSnapshot = async (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): Promise<SidebarSnapshot | null> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  if (!existsSync(databasePath)) return null

  const database = await openDatabaseFromPath(databasePath)
  try {
    const statementRunner = {
      get<TRow extends Record<string, unknown>>(sql: string): TRow | null {
        const statement = database.prepare(sql)
        if (!statement.step()) {
          statement.free()
          return null
        }
        const row = statement.getAsObject() as TRow
        statement.free()
        return row
      },
    }
    return readSidebarSnapshotFromExecutor(statementRunner)
  } catch (error) {
    if (isRecoverableSqliteReadError(error)) return null
    throw error
  } finally {
    database.close()
  }
}
