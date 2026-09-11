import type { DigimonNode } from "./digimon-node.ts"
import { pickEvolutionTarget, pickRandomSameStageOpponent } from "./evolution-battle.ts"
import { DIGIMON_STAGES, type DigimonStage } from "./stage.ts"

export type StageThresholds = Readonly<Record<DigimonStage, number>>

export const STAGE_GAUGE_THRESHOLDS = Object.freeze({
  0: 5_000_000,
  1: 10_000_000,
  2: 20_000_000,
  3: 40_000_000,
  4: 75_000_000,
  5: 125_000_000,
  6: 200_000_000,
  7: 300_000_000,
} as const satisfies StageThresholds)

export type PartnerEvolutionState = {
  readonly current: DigimonNode
  readonly gauge: number
  readonly isTerminal: boolean
  readonly pendingEvolutionTargetId: string | null
  readonly battleOpponentNodeId: string | null
}

export type EvolutionSelector = () => number

const isRecord = (value: unknown): value is Readonly<Record<PropertyKey, unknown>> => {
  return typeof value === "object" && value !== null
}

const isStageThresholds = (thresholds: unknown): thresholds is StageThresholds => {
  if (!isRecord(thresholds) || !Object.isFrozen(thresholds)) return false

  return DIGIMON_STAGES.every((stage) => {
    const threshold = thresholds[stage]
    return typeof threshold === "number" && Number.isFinite(threshold) && threshold > 0
  })
}

const hasPendingBattle = (state: PartnerEvolutionState): boolean =>
  state.pendingEvolutionTargetId != null && state.battleOpponentNodeId != null

export const applyTokenProgress = (
  state: PartnerEvolutionState,
  tokenDelta: number,
  selector: EvolutionSelector,
  digimonById: ReadonlyMap<string, DigimonNode>,
  catalogNodes: readonly DigimonNode[],
  thresholds: unknown,
): PartnerEvolutionState => {
  if (!isStageThresholds(thresholds)) {
    throw new Error("Evolution thresholds must be a complete frozen policy of positive finite numbers")
  }
  if (state.isTerminal) return state
  if (hasPendingBattle(state)) return state

  const threshold = thresholds[state.current.stage]
  const gauge = state.gauge + tokenDelta
  if (gauge < threshold) return { ...state, gauge }
  if (state.current.nextEvolutions.length === 0) {
    return { ...state, gauge: 0, isTerminal: true, pendingEvolutionTargetId: null, battleOpponentNodeId: null }
  }

  const pendingEvolutionTargetId = pickEvolutionTarget(state.current, selector)
  const target = digimonById.get(pendingEvolutionTargetId)
  if (target === undefined) {
    throw new Error(`Evolution target ${pendingEvolutionTargetId} is missing from the catalog`)
  }

  if (state.current.stage === 0) {
    return {
      current: target,
      gauge: 0,
      isTerminal: target.nextEvolutions.length === 0,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    }
  }

  const battleOpponentNodeId = pickRandomSameStageOpponent(state.current, catalogNodes, selector)
  if (digimonById.get(battleOpponentNodeId) === undefined) {
    throw new Error(`Battle opponent ${battleOpponentNodeId} is missing from the catalog`)
  }

  return {
    current: state.current,
    gauge: threshold,
    isTerminal: false,
    pendingEvolutionTargetId,
    battleOpponentNodeId,
  }
}

export const resolveEvolutionBattle = (
  state: PartnerEvolutionState,
  won: boolean,
  digimonById: ReadonlyMap<string, DigimonNode>,
): PartnerEvolutionState => {
  if (!hasPendingBattle(state)) {
    throw new Error("Cannot resolve evolution battle without a pending battle")
  }

  if (!won) {
    return {
      current: state.current,
      gauge: 0,
      isTerminal: state.isTerminal,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    }
  }

  const targetId = state.pendingEvolutionTargetId
  if (targetId === null) throw new Error("Pending evolution target is missing")
  const current = digimonById.get(targetId)
  if (current === undefined) throw new Error(`Evolution target ${targetId} is missing from the catalog`)

  return {
    current,
    gauge: 0,
    isTerminal: current.nextEvolutions.length === 0,
    pendingEvolutionTargetId: null,
    battleOpponentNodeId: null,
  }
}
