import type { MonsterFrameCatalog } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import type { MonsterFrameName } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { MONSTER_FRAME_COLUMNS, MONSTER_FRAME_ROWS } from "../../shared/constants/monster-artwork.ts"
import { DEFEAT_CYCLE_MS, DEFEAT_CYCLES, DEFEAT_PRE_ANIMATION_MS } from "../../shared/constants/presentation-timing.ts"
import { sleep } from "../../shared/sleep.ts"

const NORMAL_FRAME: MonsterFrameName = "walk_1"
const SAD_FRAMES: readonly MonsterFrameName[] = ["refuse", "injured_1"]

export type DefeatArtworkScene = {
  readonly sad: boolean
  readonly sadAlt: boolean
}

const frameLines = (catalog: MonsterFrameCatalog, sprite: string, frameName: MonsterFrameName): string[] => {
  const frame = catalog.get(sprite, frameName) ?? catalog.get(sprite, "walk_1")
  if (frame === undefined) return Array.from({ length: MONSTER_FRAME_ROWS }, () => " ".repeat(MONSTER_FRAME_COLUMNS))
  return frame.content.split("\n")
}

const sadFrameFor = (catalog: MonsterFrameCatalog, sprite: string, sadAlt: boolean): MonsterFrameName => {
  const preferred = sadAlt ? SAD_FRAMES[1] : SAD_FRAMES[0]
  if (preferred !== undefined && catalog.get(sprite, preferred) !== undefined) return preferred
  const fallback = SAD_FRAMES.find((frameName) => catalog.get(sprite, frameName) !== undefined)
  return fallback ?? "injured_1"
}

const centerArtwork = (rows: readonly string[], viewportWidth: number): string => {
  const padding = Math.max(Math.floor((viewportWidth - MONSTER_FRAME_COLUMNS) / 2), 0)
  return rows.map((row) => `${" ".repeat(padding)}${row}`).join("\n")
}

export const renderDefeatArtwork = (
  catalog: MonsterFrameCatalog,
  sprite: string,
  scene: DefeatArtworkScene,
  viewportWidth: number,
): string => {
  const frameName = scene.sad ? sadFrameFor(catalog, sprite, scene.sadAlt) : NORMAL_FRAME
  const spriteRows = frameLines(catalog, sprite, frameName)
  return centerArtwork(spriteRows, viewportWidth)
}

export const runDefeatAnimation = async (
  catalog: MonsterFrameCatalog,
  sprite: string,
  viewportWidth: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  await sleep(DEFEAT_PRE_ANIMATION_MS)

  for (let cycle = 0; cycle < DEFEAT_CYCLES; cycle += 1) {
    const sad = cycle % 2 === 1
    const sadAlt = cycle % 4 >= 2
    await onFrame(renderDefeatArtwork(catalog, sprite, { sad, sadAlt }, viewportWidth))
    if (cycle < DEFEAT_CYCLES - 1) await sleep(DEFEAT_CYCLE_MS)
  }
}
