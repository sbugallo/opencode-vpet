import { DEFAULT_STAGE_THRESHOLDS, DEFAULT_VPET_SETTINGS } from "./defaults.ts"
import type { ResolvedVpetSettings, StageThresholdKey, VpetLanguage } from "./types.ts"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const isLanguage = (value: unknown): value is VpetLanguage => value === "en" || value === "jp"

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean"

const isThreshold = (value: unknown): value is number => {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

const read = (input: Readonly<Record<string, unknown>>, key: string): unknown => {
  try {
    return input[key]
  } catch {
    return undefined
  }
}

const normalizeThreshold = (input: Readonly<Record<string, unknown>>, key: StageThresholdKey): number => {
  const value = read(input, key)
  return isThreshold(value) ? value : DEFAULT_STAGE_THRESHOLDS[key]
}

export const normalizeVpetSettings = (input: unknown): ResolvedVpetSettings => {
  try {
    if (!isRecord(input)) return DEFAULT_VPET_SETTINGS

    const thresholdInput = read(input, "stageThresholds")
    const thresholds = isRecord(thresholdInput) ? thresholdInput : {}
    const stageThresholds = Object.freeze({
      egg: normalizeThreshold(thresholds, "egg"),
      babyI: normalizeThreshold(thresholds, "babyI"),
      babyII: normalizeThreshold(thresholds, "babyII"),
      child: normalizeThreshold(thresholds, "child"),
      adult: normalizeThreshold(thresholds, "adult"),
      perfect: normalizeThreshold(thresholds, "perfect"),
      ultimate: normalizeThreshold(thresholds, "ultimate"),
      superUltimate: normalizeThreshold(thresholds, "superUltimate"),
    } as const)

    const language = read(input, "language")
    const notifications = read(input, "notifications")
    return Object.freeze({
      language: isLanguage(language) ? language : DEFAULT_VPET_SETTINGS.language,
      notifications: isBoolean(notifications) ? notifications : DEFAULT_VPET_SETTINGS.notifications,
      stageLabels: DEFAULT_VPET_SETTINGS.stageLabels,
      stageThresholds,
    })
  } catch {
    return DEFAULT_VPET_SETTINGS
  }
}
