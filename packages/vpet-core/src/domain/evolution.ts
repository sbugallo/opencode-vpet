import type { DigimonNode } from "./digimon-node.ts"
import { DIGIMON_STAGES, type DigimonStage } from "./stage.ts"

export type StageThresholds = Readonly<Record<DigimonStage, number>>

export const STAGE_GAUGE_THRESHOLDS = Object.freeze({
  0: 500_000,
  1: 1_000_000,
  2: 2_000_000,
  3: 4_000_000,
  4: 7_500_000,
  5: 12_500_000,
  6: 20_000_000,
  7: 30_000_000,
} as const satisfies StageThresholds)

export type PartnerEvolutionState = {
  readonly current: DigimonNode
  readonly gauge: number
  readonly isTerminal: boolean
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

export const applyTokenProgress = (
  state: PartnerEvolutionState,
  tokenDelta: number,
  selector: EvolutionSelector,
  digimonById: ReadonlyMap<string, DigimonNode>,
  thresholds: unknown,
): PartnerEvolutionState => {
  if (!isStageThresholds(thresholds)) {
    throw new Error("Evolution thresholds must be a complete frozen policy of positive finite numbers")
  }
  if (state.isTerminal) return state

  const gauge = state.gauge + tokenDelta
  if (gauge < thresholds[state.current.stage]) return { ...state, gauge }
  if (state.current.nextEvolutions.length === 0) return { ...state, gauge: 0, isTerminal: true }

  const selection = selector()
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new Error(`Evolution selector must return a finite number in [0, 1), received ${selection}`)
  }

  const targetId = state.current.nextEvolutions[Math.floor(selection * state.current.nextEvolutions.length)]
  if (targetId === undefined) throw new Error("Evolution target selection failed")
  const current = digimonById.get(targetId)
  if (current === undefined) throw new Error(`Evolution target ${targetId} is missing from the catalog`)

  return { current, gauge: 0, isTerminal: current.nextEvolutions.length === 0 }
}
