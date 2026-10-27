import { DIGIMON_STAGES, type DigimonStage } from "../domain/stage.ts"

export const VPET_LANGUAGES = Object.freeze(["en", "jp"] as const)

export type VpetLanguage = (typeof VPET_LANGUAGES)[number]

export const STAGE_THRESHOLD_KEYS = DIGIMON_STAGES

export type StageThresholdKey = DigimonStage

export type StageThresholdSettings = Readonly<Record<StageThresholdKey, number>>

export type StageLabels = Readonly<Record<StageThresholdKey, string>>

export type VpetStageLabels = Readonly<Record<VpetLanguage, StageLabels>>

export type ResolvedVpetSettings = Readonly<{
  readonly language: VpetLanguage
  readonly notifications: boolean
  readonly stageLabels: VpetStageLabels
  readonly stageThresholds: StageThresholdSettings
}>
