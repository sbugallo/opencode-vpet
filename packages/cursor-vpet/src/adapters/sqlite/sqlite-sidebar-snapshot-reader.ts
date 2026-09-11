import { existsSync, readFileSync } from "node:fs"
import type { SqlJsStatic } from "sql.js"

import {
  ACTIVE_PARTNER_SELECT,
  toPartner,
  type PersistedPartnerRow,
  type TrainerStateRow,
} from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-schema.ts"
import type { SidebarSnapshot, SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import type { SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"

import { CONTROL_STATE_SELECT, TRAINER_STATE_SELECT } from "../../shared/constants/sqlite.ts"
import { isRecoverableSqliteReadError } from "./errors.ts"
import { resolveDatabasePath, type SqliteDatabaseOptions } from "./options.ts"
import { getSqlRuntime } from "./sqljs-config.ts"

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

const readSidebarSnapshotWithRuntime = (SQL: SqlJsStatic, databasePath: string): SidebarSnapshot | null => {
  if (!existsSync(databasePath)) return null

  const database = new SQL.Database(readFileSync(databasePath))
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

export const createSqliteSidebarSnapshotReader = async (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): Promise<SidebarSnapshotReader> => {
  const databasePath = resolveDatabasePath(options)
  const SQL = await getSqlRuntime()

  return {
    getSidebarSnapshot(): SidebarSnapshot | null {
      return readSidebarSnapshotWithRuntime(SQL, databasePath)
    },
  }
}

export const readSidebarSnapshot = async (
  options: CreateSqliteSidebarSnapshotReaderOptions = {},
): Promise<SidebarSnapshot | null> => {
  const databasePath = resolveDatabasePath(options)
  const SQL = await getSqlRuntime()
  return readSidebarSnapshotWithRuntime(SQL, databasePath)
}
