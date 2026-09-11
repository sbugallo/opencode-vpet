import { describe, expect, test } from "bun:test"

import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { runEvolutionRevealSession } from "../src/webview/presentation/evolution-reveal-session.ts"

describe("evolution reveal session", () => {
  test("Given a valid evolution transition When running the session Then it renders evolution artwork", async () => {
    const frames: string[] = []
    const revealed = await runEvolutionRevealSession({ fromNodeId: "0-001", toNodeId: "1-001" }, 80, {
      frameCatalog: MONSTER_FRAME_CATALOG,
      digimonCatalog: DIGIMON_CATALOG,
      onArtwork: async (artwork) => {
        frames.push(artwork)
      },
    })

    expect(revealed).toBeTrue()
    expect(frames.length).toBeGreaterThan(0)
  })

  test("Given an unknown node When running the session Then it is a no-op", async () => {
    const frames: string[] = []
    const revealed = await runEvolutionRevealSession({ fromNodeId: "missing", toNodeId: "1-001" }, 80, {
      frameCatalog: MONSTER_FRAME_CATALOG,
      digimonCatalog: DIGIMON_CATALOG,
      onArtwork: async (artwork) => {
        frames.push(artwork)
      },
    })

    expect(revealed).toBeFalse()
    expect(frames).toEqual([])
  })
})
