import type { StageLabels, StageThresholdKey } from "../config/types.ts"
import { DIGIMON_STAGES, isDigimonStage, type DigimonStage } from "../domain/stage.ts"

export { isDigimonStage, type DigimonStage }

export const STAGE_VALUES = DIGIMON_STAGES

export const STAGE_THRESHOLD_KEYS = {
  0: "egg",
  1: "babyI",
  2: "babyII",
  3: "child",
  4: "adult",
  5: "perfect",
  6: "ultimate",
  7: "superUltimate",
} as const satisfies Record<DigimonStage, StageThresholdKey>

export const getStageKey = (stage: DigimonStage): StageThresholdKey => STAGE_THRESHOLD_KEYS[stage]

export const getStageLabel = (stage: DigimonStage, labels: StageLabels): string => labels[getStageKey(stage)]
