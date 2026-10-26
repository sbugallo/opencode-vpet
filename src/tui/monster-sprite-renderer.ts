import type { MonsterFrame } from "../data/monster-frame-catalog.ts"

export const SPRITE_COLUMNS = 16
export const SPRITE_PIXEL_ROWS = 16
const SPRITE_ROWS = SPRITE_PIXEL_ROWS / 2

export type MonsterSpriteFacing = "left" | "right"

/** A coalesced span of a rendered sprite row; `null` colors inherit the backdrop. */
export type MonsterSpriteRun = {
  readonly start: number
  readonly length: number
  readonly fg: string | null
  readonly bg: string | null
}

export type MonsterSpriteRow = {
  readonly text: string
  readonly runs: readonly MonsterSpriteRun[]
}

/** Eight rows of half-block glyphs, one per vertical pixel pair. */
export type MonsterSprite = readonly MonsterSpriteRow[]

const pixelColor = (frame: MonsterFrame, index: number): string | null => {
  const value = frame.pixels[index]
  return value === undefined || value === 0 ? null : (frame.palette[value] ?? null)
}

/**
 * Maps a vertical pixel pair onto a half-block glyph. A top pixel always
 * renders as `▀` (foreground = top, background = bottom when opaque, so the
 * glyph covers the upper half and the background shows through the lower half);
 * a bottom-only pixel renders as `▄` with no background so the backdrop shows
 * through the upper half; a blank cell defers entirely. A full block `█` is
 * never used: it would cover the whole cell and hide the bottom pixel's color.
 */
const cellGlyph = (top: string | null, bottom: string | null): string => {
  if (top !== null) return "▀"
  if (bottom !== null) return "▄"
  return " "
}

const renderRow = (frame: MonsterFrame, row: number, facing: MonsterSpriteFacing): MonsterSpriteRow => {
  const characters: string[] = []
  const foregrounds: (string | null)[] = []
  const backgrounds: (string | null)[] = []
  for (let column = 0; column < SPRITE_COLUMNS; column += 1) {
    const sourceColumn = facing === "right" ? SPRITE_COLUMNS - 1 - column : column
    const topIndex = row * SPRITE_COLUMNS * 2 + sourceColumn
    const top = pixelColor(frame, topIndex)
    const bottom = pixelColor(frame, topIndex + SPRITE_COLUMNS)
    const cell = cellGlyph(top, bottom)
    characters.push(cell)
    foregrounds.push(top ?? bottom)
    backgrounds.push(top !== null ? bottom : null)
  }

  const runs: MonsterSpriteRun[] = []
  let start = 0
  for (let column = 1; column <= SPRITE_COLUMNS; column += 1) {
    if (
      column < SPRITE_COLUMNS &&
      foregrounds[column] === foregrounds[start] &&
      backgrounds[column] === backgrounds[start]
    )
      continue
    runs.push({ start, length: column - start, fg: foregrounds[start] ?? null, bg: backgrounds[start] ?? null })
    start = column
  }

  return { text: characters.join(""), runs: Object.freeze(runs) }
}

const renderSprite = (frame: MonsterFrame, facing: MonsterSpriteFacing): MonsterSprite => {
  const rows: MonsterSpriteRow[] = []
  for (let row = 0; row < SPRITE_ROWS; row += 1) rows.push(renderRow(frame, row, facing))
  return Object.freeze(rows)
}

// Frames are held alive by the lazy frame catalog, so the memoization is
// bounded by the roster itself and collected with any stray frame.
const spriteCache = new WeakMap<MonsterFrame, { left?: MonsterSprite; right?: MonsterSprite }>()

/** Renders (and memoizes) a frame as eight half-block rows for the given facing. */
export const renderMonsterSprite = (frame: MonsterFrame, facing: MonsterSpriteFacing = "left"): MonsterSprite => {
  let entry = spriteCache.get(frame)
  if (entry === undefined) {
    entry = {}
    spriteCache.set(frame, entry)
  }
  const cached = entry[facing]
  if (cached !== undefined) return cached
  const rendered = renderSprite(frame, facing)
  entry[facing] = rendered
  return rendered
}
