import type { StageLabels } from "../config/types.ts"
import { DIGIMON_STAGES, isDigimonStage, type DigimonStage } from "../domain/stage.ts"

export { isDigimonStage, type DigimonStage }

export const STAGE_VALUES = DIGIMON_STAGES

export const getStageLabel = (stage: DigimonStage, labels: StageLabels): string => labels[stage]
