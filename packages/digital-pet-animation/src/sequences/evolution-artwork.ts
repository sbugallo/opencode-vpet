import type { MonsterFrameCatalog, MonsterFrameName } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"

import { MONSTER_FRAME_COLUMNS, MONSTER_FRAME_ROWS } from "../constants/monster-artwork.ts"
import {
  EVOLUTION_GLOW_MS,
  EVOLUTION_MORPH_MS,
  EVOLUTION_PRE_ANIMATION_MS,
  EVOLUTION_REVEAL_MS,
  EVOLUTION_TICK_MS,
} from "../constants/presentation-timing.ts"
import { sleep } from "../utils/sleep.ts"

const GLOW_GLYPHS = "▄▀█░"

export type EvolutionArtworkPhase = "glow" | "morph" | "reveal"

export type EvolutionArtworkScene = {
  readonly phase: EvolutionArtworkPhase
  readonly progress: number
}

const frameLines = (catalog: MonsterFrameCatalog, sprite: string, frameName: MonsterFrameName): string[] => {
  const frame = catalog.get(sprite, frameName) ?? catalog.get(sprite, "walk_1")
  if (frame === undefined) return Array.from({ length: MONSTER_FRAME_ROWS }, () => " ".repeat(MONSTER_FRAME_COLUMNS))
  return frame.content.split("\n")
}

const padRow = (row: string, width: number): string => row.padEnd(width, " ").slice(0, width)

const centerArtwork = (rows: readonly string[], viewportWidth: number): string => {
  const padding = Math.max(Math.floor((viewportWidth - MONSTER_FRAME_COLUMNS) / 2), 0)
  return rows.map((row) => `${" ".repeat(padding)}${row}`).join("\n")
}

const glowRow = (row: string, intensity: number, tick: number): string => {
  const cells = Array.from(padRow(row, MONSTER_FRAME_COLUMNS))
  return cells
    .map((cell, column) => {
      if (cell === " ") return cell
      const wave = Math.sin((column + tick) * 0.85) * 0.5 + 0.5
      if (wave < intensity) return cell
      const glyph = GLOW_GLYPHS[(column + tick) % GLOW_GLYPHS.length] ?? "█"
      return glyph
    })
    .join("")
}

const morphRow = (fromRow: string, toRow: string, progress: number, rowIndex: number): string => {
  const from = Array.from(padRow(fromRow, MONSTER_FRAME_COLUMNS))
  const to = Array.from(padRow(toRow, MONSTER_FRAME_COLUMNS))
  return from
    .map((fromCell, column) => {
      const toCell = to[column] ?? " "
      const threshold = (column / MONSTER_FRAME_COLUMNS) * 0.65 + (rowIndex / MONSTER_FRAME_ROWS) * 0.35
      if (progress >= threshold) return toCell === " " ? fromCell : toCell
      return fromCell
    })
    .join("")
}

const applyGlow = (rows: string[], progress: number, tick: number): string[] =>
  rows.map((row, rowIndex) => glowRow(row, progress * 0.75 + rowIndex * 0.02, tick + rowIndex))

const applyMorph = (fromRows: string[], toRows: string[], progress: number): string[] =>
  fromRows.map((fromRow, rowIndex) => morphRow(fromRow, toRows[rowIndex] ?? "", progress, rowIndex))

export const renderEvolutionArtwork = (
  catalog: MonsterFrameCatalog,
  fromSprite: string,
  toSprite: string,
  scene: EvolutionArtworkScene,
  viewportWidth: number,
  tick = 0,
): string => {
  const fromRows = frameLines(catalog, fromSprite, "walk_1")
  const toRows = frameLines(catalog, toSprite, "walk_1")
  const happyRows = frameLines(catalog, toSprite, "happy")

  let spriteRows: string[]
  switch (scene.phase) {
    case "glow":
      spriteRows = applyGlow(fromRows, scene.progress, tick)
      break
    case "morph":
      spriteRows = applyMorph(fromRows, toRows, scene.progress)
      break
    case "reveal": {
      const revealBlend = scene.progress < 0.35 ? applyMorph(toRows, happyRows, scene.progress / 0.35) : happyRows
      spriteRows = revealBlend
      break
    }
  }

  return centerArtwork(spriteRows, viewportWidth)
}

const animatePhase = async (
  catalog: MonsterFrameCatalog,
  fromSprite: string,
  toSprite: string,
  viewportWidth: number,
  phase: EvolutionArtworkPhase,
  durationMs: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  const steps = Math.max(1, Math.ceil(durationMs / EVOLUTION_TICK_MS))
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    const artwork = renderEvolutionArtwork(catalog, fromSprite, toSprite, { phase, progress }, viewportWidth, step)
    await onFrame(artwork)
    if (step < steps) await sleep(EVOLUTION_TICK_MS)
  }
}

export const runEvolutionAnimation = async (
  catalog: MonsterFrameCatalog,
  fromSprite: string,
  toSprite: string,
  viewportWidth: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  await sleep(EVOLUTION_PRE_ANIMATION_MS)
  await animatePhase(catalog, fromSprite, toSprite, viewportWidth, "glow", EVOLUTION_GLOW_MS, onFrame)
  await animatePhase(catalog, fromSprite, toSprite, viewportWidth, "morph", EVOLUTION_MORPH_MS, onFrame)
  await animatePhase(catalog, fromSprite, toSprite, viewportWidth, "reveal", EVOLUTION_REVEAL_MS, onFrame)
}
