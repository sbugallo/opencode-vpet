import type { DigimonNode } from "../../domain/digimon-node.ts"
import { resolveEvolutionBattle } from "../../domain/evolution.ts"
import type { Partner } from "../../domain/partner.ts"
import type { ResolveEvolutionBattleOutcome } from "../models/usage.ts"

export type EvolutionBattleRepository = {
  getActivePartner: () => Partner | null
  resolveEvolutionBattle: (
    nextState: import("../../domain/partner.ts").PartnerProgression,
    createdAt: string,
  ) => ResolveEvolutionBattleOutcome
}

export const resolveEvolutionBattleForPartner = (
  repository: EvolutionBattleRepository,
  won: boolean,
  digimonById: ReadonlyMap<string, DigimonNode>,
  createdAt: string,
): ResolveEvolutionBattleOutcome => {
  const partner = repository.getActivePartner()
  if (partner === null) return { kind: "no_pending_battle" }

  const current = digimonById.get(partner.currentNodeId)
  if (current === undefined) {
    throw new Error(`Persisted partner node ${partner.currentNodeId} is missing from the catalog`)
  }

  if (partner.pendingEvolutionTargetId === null || partner.battleOpponentNodeId === null) {
    return { kind: "no_pending_battle" }
  }

  const next = resolveEvolutionBattle(
    {
      current,
      gauge: partner.gauge,
      isTerminal: partner.isTerminal,
      pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
      battleOpponentNodeId: partner.battleOpponentNodeId,
    },
    won,
    digimonById,
  )

  return repository.resolveEvolutionBattle(
    {
      currentNodeId: next.current.id,
      gauge: next.gauge,
      isTerminal: next.isTerminal,
      pendingEvolutionTargetId: next.pendingEvolutionTargetId,
      battleOpponentNodeId: next.battleOpponentNodeId,
    },
    createdAt,
  )
}
