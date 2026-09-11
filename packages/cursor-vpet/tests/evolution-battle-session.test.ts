import { describe, expect, mock, test } from "bun:test"

import type { ResolveEvolutionBattleOutcome } from "@sbugallo/vpet-core/application/models/usage.ts"
import type { EvolutionBattleRepository } from "@sbugallo/vpet-core/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

mock.module("../src/shared/sleep.ts", () => ({
  sleep: async () => {},
}))

import { runEvolutionBattleSession } from "../src/webview/presentation/evolution-battle-session.ts"
import { battleSidebarSnapshot } from "./sidebar/test-fixtures.ts"

const pendingBattleSnapshot = battleSidebarSnapshot()

const createRepository = (outcome: "won" | "lost"): EvolutionBattleRepository => ({
  getActivePartner: () => ({
    partnerId: "partner-1",
    generation: 1,
    currentNodeId: pendingBattleSnapshot.currentNodeId,
    gauge: pendingBattleSnapshot.gauge,
    isTerminal: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    pendingEvolutionTargetId: pendingBattleSnapshot.pendingEvolutionTargetId,
    battleOpponentNodeId: pendingBattleSnapshot.battleOpponentNodeId,
  }),
  resolveEvolutionBattle: () =>
    outcome === "won" ? { kind: "won", evolution: { fromNodeId: "3-001", toNodeId: "4-017" } } : { kind: "lost" },
})

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

  test("Given a pending battle When the player wins Then it plays battle and reveal artwork and resolves won", async () => {
    const frames: string[] = []
    let resolved: ResolveEvolutionBattleOutcome | undefined
    const battled = await runEvolutionBattleSession(pendingBattleSnapshot, 80, {
      frameCatalog: MONSTER_FRAME_CATALOG,
      digimonCatalog: DIGIMON_CATALOG,
      repository: createRepository("won"),
      random: () => 0,
      onArtwork: async (artwork) => {
        frames.push(artwork)
      },
      onResolved: async (result) => {
        resolved = result
      },
    })

    expect(battled).toBeTrue()
    expect(frames.length).toBeGreaterThan(0)
    expect(resolved).toEqual({ kind: "won", evolution: { fromNodeId: "3-001", toNodeId: "4-017" } })
  })

  test("Given a pending battle When the player loses Then it plays battle and defeat artwork and resolves lost", async () => {
    const frames: string[] = []
    let resolved: ResolveEvolutionBattleOutcome | undefined
    const battled = await runEvolutionBattleSession(pendingBattleSnapshot, 80, {
      frameCatalog: MONSTER_FRAME_CATALOG,
      digimonCatalog: DIGIMON_CATALOG,
      repository: createRepository("lost"),
      random: () => 0.99,
      onArtwork: async (artwork) => {
        frames.push(artwork)
      },
      onResolved: async (result) => {
        resolved = result
      },
    })

    expect(battled).toBeTrue()
    expect(frames.length).toBeGreaterThan(0)
    expect(resolved).toEqual({ kind: "lost" })
  })

  test("Given unknown catalog nodes When running the session Then it is a no-op", async () => {
    const frames: string[] = []
    const battled = await runEvolutionBattleSession(
      {
        ...pendingBattleSnapshot,
        currentNodeId: "missing-partner",
        battleOpponentNodeId: "missing-opponent",
      },
      80,
      {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: createRepository("won"),
        onArtwork: async (artwork) => {
          frames.push(artwork)
        },
      },
    )

    expect(battled).toBeFalse()
    expect(frames).toEqual([])
  })
})
