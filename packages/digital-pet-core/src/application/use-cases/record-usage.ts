import type { DigimonNode } from "../../domain/digimon-node.ts"
import { applyTokenProgress, type EvolutionSelector, type StageThresholds } from "../../domain/evolution.ts"
import type { UsageEvolutionTransition, UsageProcessingResult, UsageReceiptMetadata } from "../models/usage.ts"
import type { UsageLedger } from "../ports/usage-ledger.ts"

export type CompletedUsage = UsageReceiptMetadata

export type RecordUsageInput = {
  readonly usage: CompletedUsage
  readonly ledger: UsageLedger
  readonly digimonById: ReadonlyMap<string, DigimonNode>
  readonly catalogNodes: readonly DigimonNode[]
  readonly selector: EvolutionSelector
  readonly thresholds: StageThresholds
}

export const recordUsage = ({
  usage,
  ledger,
  digimonById,
  catalogNodes,
  selector,
  thresholds,
}: RecordUsageInput): UsageProcessingResult => {
  let evolution: UsageEvolutionTransition | undefined
  let evolutionBattlePending: { readonly opponentNodeId: string; readonly targetNodeId: string } | undefined

  const outcome = ledger.applyUsageReceipt(usage, (partner) => {
    const current = digimonById.get(partner.currentNodeId)
    if (current === undefined)
      throw new Error(`Persisted partner node ${partner.currentNodeId} is missing from the catalog`)

    const hadPendingBattle = partner.pendingEvolutionTargetId != null && partner.battleOpponentNodeId != null

    const next = applyTokenProgress(
      {
        current,
        gauge: partner.gauge,
        isTerminal: partner.isTerminal,
        pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
        battleOpponentNodeId: partner.battleOpponentNodeId,
      },
      usage.tokenDelta,
      selector,
      digimonById,
      catalogNodes,
      thresholds,
    )

    if (
      !hadPendingBattle &&
      next.pendingEvolutionTargetId !== null &&
      next.battleOpponentNodeId !== null &&
      next.current.id === current.id
    ) {
      evolutionBattlePending = {
        opponentNodeId: next.battleOpponentNodeId,
        targetNodeId: next.pendingEvolutionTargetId,
      }
    }

    if (next.current.id !== current.id) {
      evolution = { fromNodeId: current.id, toNodeId: next.current.id }
    }

    return {
      currentNodeId: next.current.id,
      gauge: next.gauge,
      isTerminal: next.isTerminal,
      pendingEvolutionTargetId: next.pendingEvolutionTargetId,
      battleOpponentNodeId: next.battleOpponentNodeId,
    }
  })

  switch (outcome.kind) {
    case "applied":
      if (evolutionBattlePending !== undefined) {
        return { kind: "applied", receiptKey: usage.receiptKey, evolutionBattlePending }
      }
      return evolution === undefined
        ? { kind: "applied", receiptKey: usage.receiptKey }
        : { kind: "applied", receiptKey: usage.receiptKey, evolution }
    case "duplicate":
      return { kind: "duplicate", receiptKey: usage.receiptKey }
    case "no_active_partner":
      return { kind: "no_active_partner", receiptKey: usage.receiptKey }
  }
}
