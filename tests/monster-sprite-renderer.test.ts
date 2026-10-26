import { describe, expect, test } from "bun:test"

import { createMonsterFrame } from "../src/data/monster-frame-catalog.ts"
import { renderMonsterSprite, SPRITE_COLUMNS } from "../src/tui/monster-sprite-renderer.ts"

const PALETTE = [null, "#ff0000", "#00ff00", "#0000ff"] as const

/** Builds a frame from 8 columns x 16 rows of palette indices (0 = transparent). */
const frameFromRows = (rows: readonly (readonly number[])[]): ReturnType<typeof createMonsterFrame> => {
  const pixels = new Uint8Array(256)
  rows.forEach((row, rowIndex) => {
    row.forEach((value, column) => {
      pixels[rowIndex * SPRITE_COLUMNS + column] = value
    })
  })
  return createMonsterFrame(pixels, PALETTE)
}

describe("renderMonsterSprite", () => {
  test("Given the four half-block pixel-pair cases, when a frame is rendered, then each cell maps to its glyph and colors", () => {
    // One 8-row sprite: each row holds the four pair cases across columns 0-3.
    const rows = Array.from({ length: 16 }, (_, index) =>
      index % 2 === 0 ? [1, 2, 0, 0, 0, 0, 0, 0] : [2, 0, 1, 0, 0, 0, 0, 0],
    )
    const sprite = renderMonsterSprite(frameFromRows(rows))

    expect(sprite).toHaveLength(8)
    const first = sprite[0]
    if (first === undefined) throw new Error("Expected first row")
    expect(first.text).toBe(`▀▀▄${" ".repeat(13)}`)
    expect(first.runs).toEqual([
      { start: 0, length: 1, fg: "#ff0000", bg: "#00ff00" },
      { start: 1, length: 1, fg: "#00ff00", bg: null },
      { start: 2, length: 1, fg: "#ff0000", bg: null },
      { start: 3, length: 13, fg: null, bg: null },
    ])
  })

  test("Given identical neighboring cells, when a row is rendered, then equal-color runs are coalesced", () => {
    const rows = Array.from({ length: 16 }, () => [1, 1, 1, 1, 2, 2, 0, 0])
    const sprite = renderMonsterSprite(frameFromRows(rows))

    const first = sprite[0]
    if (first === undefined) throw new Error("Expected first row")
    expect(first.text).toBe(`▀▀▀▀▀▀${" ".repeat(10)}`)
    expect(first.runs).toEqual([
      { start: 0, length: 4, fg: "#ff0000", bg: "#ff0000" },
      { start: 4, length: 2, fg: "#00ff00", bg: "#00ff00" },
      { start: 6, length: 10, fg: null, bg: null },
    ])
  })

  test("Given a right-facing request, when a frame is rendered, then columns are mirrored", () => {
    const rows = Array.from({ length: 16 }, (_, index) =>
      index % 2 === 0 ? [1, 0, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0, 0],
    )
    const sprite = renderMonsterSprite(frameFromRows(rows), "right")

    const first = sprite[0]
    if (first === undefined) throw new Error("Expected first row")
    expect(first.text.endsWith("▀")).toBeTrue()
    expect(first.runs.at(-1)).toEqual({ start: 15, length: 1, fg: "#ff0000", bg: null })
  })

  test("Given a fully transparent frame, when it is rendered, then every row is blank with no colors", () => {
    const sprite = renderMonsterSprite(createMonsterFrame(new Uint8Array(256), PALETTE))

    expect(sprite.every((row) => row.text === " ".repeat(16))).toBeTrue()
    expect(
      sprite.every((row) => row.runs.length === 1 && row.runs[0]?.fg === null && row.runs[0]?.bg === null),
    ).toBeTrue()
  })

  test("Given repeated renders, when the same frame is requested, then the memoized rows are reused", () => {
    const frame = frameFromRows(Array.from({ length: 16 }, () => [1, 0, 0, 0, 0, 0, 0, 0]))

    expect(renderMonsterSprite(frame)).toBe(renderMonsterSprite(frame))
    expect(renderMonsterSprite(frame, "right")).toBe(renderMonsterSprite(frame, "right"))
    expect(renderMonsterSprite(frame, "right")).not.toBe(renderMonsterSprite(frame))
  })
})
