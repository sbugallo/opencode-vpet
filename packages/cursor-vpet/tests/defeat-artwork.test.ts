import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { renderDefeatArtwork } from "../src/webview/presentation/defeat-artwork.ts"

describe("defeat artwork", () => {
  test("Given normal and sad poses When rendering Then artwork alternates between them", () => {
    const normal = renderDefeatArtwork(MONSTER_FRAME_CATALOG, "agumon", { sad: false, sadAlt: false }, 48)
    const sad = renderDefeatArtwork(MONSTER_FRAME_CATALOG, "agumon", { sad: true, sadAlt: false }, 48)

    expect(normal).not.toEqual(sad)
  })

  test("Given defeat artwork When rendering Then the sprite is centered in the viewport", () => {
    const artwork = renderDefeatArtwork(MONSTER_FRAME_CATALOG, "agumon", { sad: false, sadAlt: false }, 48)
    const lines = artwork.split("\n").filter((line) => line.trim().length > 0)

    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]?.startsWith(" ")).toBe(true)
  })
})
