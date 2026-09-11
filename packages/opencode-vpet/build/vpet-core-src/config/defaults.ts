import type { ResolvedVpetSettings, StageLabels, StageThresholdSettings, VpetStageLabels } from "./types.ts"

const EN_STAGE_LABELS = Object.freeze({
  egg: "DigiEgg",
  babyI: "In Training I",
  babyII: "In Training II",
  child: "Rookie",
  adult: "Champion",
  perfect: "Ultimate",
  ultimate: "Mega",
  superUltimate: "Ultra",
} as const satisfies StageLabels)

const JP_STAGE_LABELS = Object.freeze({
  egg: "Digitama",
  babyI: "Baby I",
  babyII: "Baby II",
  child: "Child",
  adult: "Adult",
  perfect: "Perfect",
  ultimate: "Ultimate",
  superUltimate: "SuperUltimate",
} as const satisfies StageLabels)

export const VPET_STAGE_LABELS = Object.freeze({
  en: EN_STAGE_LABELS,
  jp: JP_STAGE_LABELS,
} as const satisfies VpetStageLabels)

export const DEFAULT_STAGE_THRESHOLDS = Object.freeze({
  egg: 500_000,
  babyI: 1_000_000,
  babyII: 2_000_000,
  child: 4_000_000,
  adult: 7_500_000,
  perfect: 12_500_000,
  ultimate: 20_000_000,
  superUltimate: 30_000_000,
} as const satisfies StageThresholdSettings)

export const DEFAULT_VPET_SETTINGS = Object.freeze({
  language: "jp",
  notifications: true,
  stageLabels: VPET_STAGE_LABELS,
  stageThresholds: DEFAULT_STAGE_THRESHOLDS,
} as const satisfies ResolvedVpetSettings)
