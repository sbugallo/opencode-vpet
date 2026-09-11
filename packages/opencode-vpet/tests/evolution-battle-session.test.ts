import { describe, expect, test } from "bun:test"

import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { runEvolutionBattleSession } from "../src/tui/evolution-battle-session.ts"

describe("evolution battle session", () => {
  test("Given a snapshot without a pending battle When running the session Then it is a no-op", async () => {
    const frames: string[] = []
    const battled = await runEvolutionBattleSession(
      {
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 0,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
      80,
      {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: {
          getActivePartner: () => null,
          resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }),
        },
        onArtwork: async (artwork) => {
          frames.push(artwork)
        },
      },
    )

    expect(battled).toBeFalse()
    expect(frames).toEqual([])
  })
})
