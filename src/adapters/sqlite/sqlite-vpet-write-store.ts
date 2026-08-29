import type { SpawnPartnerInput } from "../../application/models/spawn-partner.ts"
import type { UsageReceiptMetadata } from "../../application/models/usage.ts"
import type { Partner, PartnerProgression } from "../../domain/partner.ts"
import { resolveHostDatabasePath, type HostPathOptions } from "./app-data-path.ts"
import { createExecutor, openWritableDatabase } from "./bun-sqlite-driver.ts"
import { runMigrations } from "./sqlite-migrations.ts"
import {
  ACTIVE_PARTNER_SELECT,
  PARTNERS_SELECT,
  PARTNER_BY_GENERATION_SELECT,
  PARTNER_EVENTS_SELECT,
  USAGE_RECEIPTS_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
  type TrainerStateRow,
  type UsageReceiptRow,
  toPartner,
  toPersistedPartnerEvent,
  toUsageReceiptRecord,
} from "./sqlite-vpet-schema.ts"
import type { SqliteVpetWriteStore } from "./sqlite-vpet-types.ts"

export type CreateSqliteVpetRepositoryOptions = HostPathOptions & { readonly databasePath?: string }

type ControlStateRow = {
  readonly frozen: number
  readonly cheat_node_id: string | null
}

type ReceiptLedgerRow = {
  readonly receipt_key: string
}

export { resolveHostDatabasePath }
export type { PersistedPartnerEvent, SqliteVpetWriteStore } from "./sqlite-vpet-types.ts"

export const createSqliteVpetRepository = async (
  options: CreateSqliteVpetRepositoryOptions = {},
): Promise<SqliteVpetWriteStore> => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  const database = openWritableDatabase(databasePath)
  const executor = createExecutor(database)
  const appliedMigrations = runMigrations(executor)

  const store = {
    databasePath,
    async close() {
      database.close()
    },
    getAppliedMigrations() {
      return appliedMigrations
    },
    getTrainerState() {
      const trainerState = executor.get<TrainerStateRow>("SELECT total_tokens FROM trainer_state WHERE trainer_id = 1")
      if (trainerState === null) throw new Error("Trainer state row is missing")
      return { totalTokens: trainerState.total_tokens }
    },
    getActivePartner() {
      const activePartner = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
      return activePartner === null ? null : toPartner(activePartner)
    },
    listPartners() {
      return executor.all<PersistedPartnerRow>(PARTNERS_SELECT).map(toPartner)
    },
    getPartnerByGeneration(generation: number) {
      const partner = executor.get<PersistedPartnerRow>(PARTNER_BY_GENERATION_SELECT, [generation])
      return partner === null ? null : toPartner(partner)
    },
    freeze() {
      return executor.transaction(() => {
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error("VPet control state row is missing")
        if (controlState.frozen === 1) return { kind: "already_frozen" } as const
        executor.run("UPDATE vpet_control_state SET frozen = 1 WHERE control_id = 1")
        return { kind: "frozen" } as const
      })
    },
    unfreeze() {
      return executor.transaction(() => {
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error("VPet control state row is missing")
        if (controlState.frozen === 0) return { kind: "already_unfrozen" } as const
        executor.run("UPDATE vpet_control_state SET frozen = 0 WHERE control_id = 1")
        return { kind: "unfrozen" } as const
      })
    },
    setCheatNode(cheatNodeId: string) {
      return executor.transaction(() => {
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error("VPet control state row is missing")
        if (controlState.cheat_node_id === cheatNodeId) return { kind: "already_set", cheatNodeId } as const
        executor.run("UPDATE vpet_control_state SET cheat_node_id = ? WHERE control_id = 1", [cheatNodeId])
        return { kind: "set", cheatNodeId } as const
      })
    },
    spawnPartner(input: SpawnPartnerInput) {
      return executor.transaction(() => {
        executor.run("UPDATE vpet_control_state SET frozen = 0, cheat_node_id = NULL WHERE control_id = 1")
        const activePartnerRow = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
        if (activePartnerRow !== null) {
          const activePartner = toPartner(activePartnerRow)
          executor.run("UPDATE partners SET retired_at = ? WHERE partner_id = ?", [
            input.createdAt,
            activePartner.partnerId,
          ])
          executor.run(
            "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'retired', ?, ?, ?, NULL, NULL, ?)",
            [
              `event-retired-${activePartner.generation}`,
              activePartner.partnerId,
              activePartner.currentNodeId,
              activePartner.gauge,
              activePartner.isTerminal,
              input.createdAt,
            ],
          )
        }
        const generationRow = executor.get<{ readonly generation: number }>(
          "SELECT COALESCE(MAX(generation), 0) + 1 AS generation FROM partners",
        )
        if (generationRow === null) throw new Error("Generation allocation failed")
        const partnerId = `partner-${generationRow.generation}`
        executor.run(
          "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
          [partnerId, generationRow.generation, input.currentNodeId, input.gauge, input.isTerminal, input.createdAt],
        )
        executor.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'spawned', ?, ?, ?, NULL, NULL, ?)",
          [
            `event-spawn-${generationRow.generation}`,
            partnerId,
            input.currentNodeId,
            input.gauge,
            input.isTerminal,
            input.createdAt,
          ],
        )
        return { partnerId, generation: generationRow.generation, ...input, retiredAt: null }
      })
    },
    listPartnerEvents(partnerId: string) {
      return executor.all<PersistedPartnerEventRow>(PARTNER_EVENTS_SELECT, [partnerId]).map(toPersistedPartnerEvent)
    },
    applyUsageReceipt(metadata: UsageReceiptMetadata, evolve: (partner: Partner) => PartnerProgression) {
      return executor.transaction(() => {
        const canonicalReceipt = executor.get<ReceiptLedgerRow>(
          "SELECT receipt_key FROM usage_receipts WHERE receipt_key = ? LIMIT 1",
          [metadata.receiptKey],
        )
        const controlReceipt = executor.get<ReceiptLedgerRow>(
          "SELECT receipt_key FROM vpet_control_receipts WHERE receipt_key = ? LIMIT 1",
          [metadata.receiptKey],
        )
        if (canonicalReceipt !== null || controlReceipt !== null) return { kind: "duplicate" } as const
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error("VPet control state row is missing")
        if (controlState.cheat_node_id !== null) {
          executor.run(
            "INSERT INTO vpet_control_receipts (receipt_key, mode, token_delta, cost, created_at) VALUES (?, 'cheat', ?, ?, ?)",
            [metadata.receiptKey, metadata.tokenDelta, metadata.cost ?? null, metadata.createdAt],
          )
          return { kind: "applied" } as const
        }
        if (controlState.frozen === 1) {
          executor.run(
            "INSERT INTO vpet_control_receipts (receipt_key, mode, token_delta, cost, created_at) VALUES (?, 'frozen', ?, ?, ?)",
            [metadata.receiptKey, metadata.tokenDelta, metadata.cost ?? null, metadata.createdAt],
          )
          executor.run("UPDATE trainer_state SET total_tokens = total_tokens + ? WHERE trainer_id = 1", [
            metadata.tokenDelta,
          ])
          return { kind: "applied" } as const
        }
        const activePartnerRow = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
        if (activePartnerRow === null) return { kind: "no_active_partner" } as const
        const activePartner = toPartner(activePartnerRow)
        const nextState = evolve(activePartner)
        executor.run("UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ? WHERE partner_id = ?", [
          nextState.currentNodeId,
          nextState.gauge,
          nextState.isTerminal,
          activePartner.partnerId,
        ])
        executor.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, ?, ?, ?)",
          [
            metadata.eventId,
            activePartner.partnerId,
            nextState.currentNodeId,
            nextState.gauge,
            nextState.isTerminal,
            metadata.tokenDelta,
            metadata.receiptKey,
            metadata.createdAt,
          ],
        )
        executor.run(
          "INSERT INTO usage_receipts (receipt_key, partner_id, event_id, token_delta, cost, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            metadata.receiptKey,
            activePartner.partnerId,
            metadata.eventId,
            metadata.tokenDelta,
            metadata.cost ?? null,
            metadata.createdAt,
          ],
        )
        executor.run("UPDATE trainer_state SET total_tokens = total_tokens + ? WHERE trainer_id = 1", [
          metadata.tokenDelta,
        ])
        return { kind: "applied" } as const
      })
    },
    listUsageReceipts() {
      return executor.all<UsageReceiptRow>(USAGE_RECEIPTS_SELECT).map(toUsageReceiptRecord)
    },
  } satisfies SqliteVpetWriteStore

  return store
}
