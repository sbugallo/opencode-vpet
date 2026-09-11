export const VPET_LANGUAGES = Object.freeze(["en", "jp"] as const)

export type VpetLanguage = (typeof VPET_LANGUAGES)[number]

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

export type VpetStageLabels = Readonly<Record<VpetLanguage, StageLabels>>

export type ResolvedVpetSettings = Readonly<{
  readonly language: VpetLanguage
  readonly notifications: boolean
  readonly stageLabels: VpetStageLabels
  readonly stageThresholds: StageThresholdSettings
}>
