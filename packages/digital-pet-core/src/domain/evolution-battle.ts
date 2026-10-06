import type { DigimonNode } from "./digimon-node.ts"
import type { EvolutionSelector } from "./evolution.ts"

export const pickEvolutionTarget = (current: DigimonNode, selector: EvolutionSelector): string => {
  if (current.nextEvolutions.length === 0) {
    throw new Error("Evolution target selection failed: partner has no evolution options")
  }

  const selection = selector()
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new Error(`Evolution selector must return a finite number in [0, 1), received ${selection}`)
  }

  const targetId = current.nextEvolutions[Math.floor(selection * current.nextEvolutions.length)]
  if (targetId === undefined) throw new Error("Evolution target selection failed")
  return targetId
}

export const pickRandomSameStageOpponent = (
  current: DigimonNode,
  catalogNodes: readonly DigimonNode[],
  selector: EvolutionSelector,
): string => {
  const candidates = catalogNodes.filter((node) => node.stage === current.stage && node.id !== current.id)
  if (candidates.length === 0) {
    return current.id
  }

  const selection = selector()
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new Error(`Evolution selector must return a finite number in [0, 1), received ${selection}`)
  }

  const opponent = candidates[Math.floor(selection * candidates.length)]
  if (opponent === undefined) throw new Error("Same-stage opponent selection failed")
  return opponent.id
}
