import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { renderEvolutionArtwork } from "../src/webview/evolution-artwork.ts"

describe("evolution artwork", () => {
  test("Given glow phase When rendering Then the sprite is still the current partner", () => {
    const from = renderEvolutionArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "greymon",
      { phase: "glow", progress: 0.2 },
      48,
    )
    const unchanged = renderEvolutionArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "greymon",
      { phase: "glow", progress: 0 },
      48,
    )

    expect(from.length).toBeGreaterThan(0)
    expect(from).not.toEqual(unchanged)
  })

  test("Given morph phase When progress advances Then artwork moves toward the evolved sprite", () => {
    const early = renderEvolutionArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "greymon",
      { phase: "morph", progress: 0.1 },
      48,
    )
    const late = renderEvolutionArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "greymon",
      { phase: "morph", progress: 0.9 },
      48,
    )

    expect(early).not.toEqual(late)
  })

  test("Given reveal phase When rendering Then only the evolved sprite is shown", () => {
    const artwork = renderEvolutionArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "greymon",
      { phase: "reveal", progress: 0.8 },
      48,
    )

    expect(artwork.length).toBeGreaterThan(0)
    expect(artwork).not.toContain("Child")
  })
})
