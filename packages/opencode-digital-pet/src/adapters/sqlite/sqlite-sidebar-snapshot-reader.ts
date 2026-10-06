import { existsSync } from "node:fs"

import type {
  SidebarSnapshot,
  SidebarSnapshotReader,
} from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import {
  resolveHostDatabasePath,
  type HostPathOptions,
} from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
import type { SqliteExecutor } from "@jcendal/digital-pet-core/ports/sqlite-executor.ts"
import {
  ACTIVE_PARTNER_SELECT,
  toPartner,
  type PersistedPartnerRow,
  type TrainerStateRow,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-schema.ts"

import { createExecutor, openReadonlyDatabase } from "./bun-sqlite-driver.ts"

export type CreateSqliteSidebarSnapshotReaderOptions = HostPathOptions & { readonly databasePath?: string }

const TRAINER_STATE_SELECT = "SELECT total_tokens FROM trainer_state WHERE trainer_id = 1"
const CONTROL_STATE_SELECT = "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1"

type ControlStateRow = {
  readonly frozen: number
  readonly cheat_node_id: string | null
}

const isRecoverableReadError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    (error.message.includes("sqlite") || error.message.includes("database") || error.message.includes("no such table"))
  )
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

export const createSqliteSidebarSnapshotReader = (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): SidebarSnapshotReader => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)

  return {
    getSidebarSnapshot(): SidebarSnapshot | null {
      if (!existsSync(databasePath)) return null

      try {
        const database = openReadonlyDatabase(databasePath)
        try {
          const executor = createExecutor(database)
          return readSidebarSnapshotFromExecutor(executor)
        } finally {
          database.close()
        }
      } catch (error) {
        if (isRecoverableReadError(error)) return null
        throw error
      }
    },
  }
}
