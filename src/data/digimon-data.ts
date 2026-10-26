import type { DigimonId, DigimonRecord } from "./generated/digimon-records.generated.ts"
import { DIGIMON_DATA as GENERATED_DIGIMON_DATA } from "./generated/digimon-records.generated.ts"

export type { DigimonId, DigimonRecord }

export const DIGIMON_DATA: readonly DigimonRecord[] = GENERATED_DIGIMON_DATA

export { DIGIMON_ID_MIGRATION, DIGITAMA_FIELD_EGGS } from "./generated/digimon-records.generated.ts"

export { DIGIMON_STAGES, isDigimonStage } from "../domain/stage.ts"
export type { DigimonStage } from "../domain/stage.ts"
