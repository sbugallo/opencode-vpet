export const DIGITAL_PET_LANGUAGES = Object.freeze(["en", "jp"] as const)

export type DigitalPetLanguage = (typeof DIGITAL_PET_LANGUAGES)[number]

export const STAGE_THRESHOLD_KEYS = Object.freeze([
  "egg",
  "babyI",
  "babyII",
  "child",
  "adult",
  "perfect",
  "ultimate",
  "superUltimate",
] as const)

export type StageThresholdKey = (typeof STAGE_THRESHOLD_KEYS)[number]

export type StageThresholdSettings = Readonly<Record<StageThresholdKey, number>>

export type StageLabels = Readonly<Record<StageThresholdKey, string>>

export type DigitalPetStageLabels = Readonly<Record<DigitalPetLanguage, StageLabels>>

export type ResolvedDigitalPetSettings = Readonly<{
  readonly language: DigitalPetLanguage
  readonly notifications: boolean
  readonly stageLabels: DigitalPetStageLabels
  readonly stageThresholds: StageThresholdSettings
}>
