import { existsSync } from "node:fs"

import {
  ACTIVE_PARTNER_SELECT,
  toPartner,
  type PersistedPartnerRow,
  type TrainerStateRow,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-schema.ts"
import type {
  SidebarSnapshot,
  SidebarSnapshotReader,
} from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import type { SqliteExecutor } from "@jcendal/digital-pet-core/ports/sqlite-executor.ts"

import { CONTROL_STATE_SELECT, TRAINER_STATE_SELECT } from "../../shared/constants/sqlite.ts"
import { isRecoverableSqliteReadError } from "./errors.ts"
import { resolveDatabasePath, type SqliteDatabaseOptions } from "./options.ts"
import { openReadonlySqliteDatabase } from "./sqlite-driver.ts"

export type CreateSqliteSidebarSnapshotReaderOptions = SqliteDatabaseOptions

type ControlStateRow = {
  readonly frozen: number
  readonly cheat_node_id: string | null
}

export const readSidebarSnapshotFromExecutor = (executor: Pick<SqliteExecutor, "get">): SidebarSnapshot | null => {
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
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
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
    pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
    battleOpponentNodeId: partner.battleOpponentNodeId,
  }
}

const readSidebarSnapshotAtPath = (databasePath: string): SidebarSnapshot | null => {
  if (!existsSync(databasePath)) return null

  const database = openReadonlySqliteDatabase(databasePath)
  try {
    return readSidebarSnapshotFromExecutor(database.executor)
  } catch (error) {
    if (isRecoverableSqliteReadError(error)) return null
    throw error
  } finally {
    database.close()
  }
}

export const createSqliteSidebarSnapshotReader = async (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): Promise<SidebarSnapshotReader> => {
  const databasePath = resolveDatabasePath(options)

  return {
    getSidebarSnapshot(): SidebarSnapshot | null {
      return readSidebarSnapshotAtPath(databasePath)
    },
  }
}

export const readSidebarSnapshot = async (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): Promise<SidebarSnapshot | null> => {
  return readSidebarSnapshotAtPath(resolveDatabasePath(options))
}
