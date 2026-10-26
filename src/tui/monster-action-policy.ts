import type { MonsterFrameCatalog, MonsterFrameName } from "../data/monster-frame-catalog.ts"

export type CosmeticActionClip = readonly [MonsterFrameName, MonsterFrameName]
export type SleepClip = readonly [MonsterFrameName, MonsterFrameName]

const SINGLE_FRAME_ACTIONS = ["angry", "happy", "sick"] as const

export const resolveCosmeticActions = (sprite: string, catalog: MonsterFrameCatalog): readonly CosmeticActionClip[] => {
  const actions: CosmeticActionClip[] = []
  for (const frameName of SINGLE_FRAME_ACTIONS) {
    if (catalog.get(sprite, frameName) !== undefined) actions.push([frameName, frameName])
  }
  const attackFirst = catalog.get(sprite, "attack_1") === undefined ? undefined : "attack_1"
  const attackSecond = catalog.get(sprite, "attack_2") === undefined ? undefined : "attack_2"
  if (attackFirst !== undefined && attackSecond !== undefined) actions.push([attackFirst, attackSecond])
  else if (attackFirst !== undefined) actions.push([attackFirst, attackFirst])
  else if (attackSecond !== undefined) actions.push([attackSecond, attackSecond])
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
