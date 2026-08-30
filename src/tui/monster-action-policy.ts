import type { MonsterFrameCatalog, MonsterFrameName } from "../data/monster-frame-catalog.ts"

export type CosmeticActionClip = readonly [MonsterFrameName, MonsterFrameName]
export type SleepClip = readonly [MonsterFrameName, MonsterFrameName]

const SINGLE_FRAME_ACTIONS = ["angry", "attack", "happy"] as const

export const resolveCosmeticActions = (sprite: string, catalog: MonsterFrameCatalog): readonly CosmeticActionClip[] => {
  const actions: CosmeticActionClip[] = []
  for (const frameName of SINGLE_FRAME_ACTIONS) {
    if (catalog.get(sprite, frameName) !== undefined) actions.push([frameName, frameName])
  }
  const injuredFirst = catalog.get(sprite, "injured_1") === undefined ? undefined : "injured_1"
  const injuredSecond = catalog.get(sprite, "injured_2") === undefined ? undefined : "injured_2"
  if (injuredFirst !== undefined && injuredSecond !== undefined) actions.push([injuredFirst, injuredSecond])
  else if (injuredFirst !== undefined) actions.push([injuredFirst, injuredFirst])
  else if (injuredSecond !== undefined) actions.push([injuredSecond, injuredSecond])
  return actions
}

export const selectCosmeticAction = (
  actions: readonly CosmeticActionClip[],
  random: () => number,
): CosmeticActionClip | undefined => {
  if (actions.length === 0) return undefined
  return actions[Math.floor(normalizedRandom(random) * actions.length)]
}

export const resolveSleepClip = (
  sprite: string,
  fallback: MonsterFrameName,
  catalog: MonsterFrameCatalog,
): SleepClip => {
  const first = catalog.get(sprite, "sleep_1") === undefined ? undefined : "sleep_1"
  const second = catalog.get(sprite, "sleep_2") === undefined ? undefined : "sleep_2"
  if (first !== undefined && second !== undefined) return [first, second]
  if (first !== undefined) return [first, first]
  if (second !== undefined) return [second, second]
  return [fallback, fallback]
}

const normalizedRandom = (random: () => number): number => {
  const sample = random()
  if (!Number.isFinite(sample) || sample <= 0) return 0
  return sample >= 1 ? 1 - Number.EPSILON : sample
}
