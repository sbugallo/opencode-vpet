import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { EVOLUTION_BATTLE_HITS_TO_WIN } from "../src/shared/constants/evolution-battle.ts"
import {
  buildBattleIntroTextLines,
  buildBattleScorePips,
  buildBattleScoreRow,
  defaultBattleScene,
  FIREBALL_LINES,
  planEvolutionBattle,
  renderBattleIntroArtwork,
  renderEvolutionBattleArtwork,
} from "../src/webview/presentation/evolution-battle-artwork.ts"

const countHits = (shots: readonly { readonly shooter: "player" | "opponent"; readonly hit: boolean }[]) => ({
  playerHits: shots.filter((shot) => shot.shooter === "player" && shot.hit).length,
  opponentHits: shots.filter((shot) => shot.shooter === "opponent" && shot.hit).length,
})

describe("evolution battle artwork", () => {
  test("Given battle intro When ticking Then FIGlet BATTLE banner blinks", () => {
    const textLines = buildBattleIntroTextLines()
    const on = renderBattleIntroArtwork(80, 1, 0)
    const off = renderBattleIntroArtwork(80, 1, 1)

    expect(textLines).toHaveLength(6)
    expect(textLines[0]).toContain("██████╗")
    expect(on).toContain("███████╗")
    expect(off).not.toContain("█")
    expect(on).not.toEqual(off)
  })

  test("Given a fireball shot When rendering Then the flame uses block-style sprite art", () => {
    const artwork = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ shooter: "player", progress: 0.5 }),
      80,
    )

    for (const line of FIREBALL_LINES) {
      for (const character of line.replaceAll(" ", "")) {
        expect(artwork).toContain(character)
      }
    }
  })

  test("Given opponent shot When rendering Then the fireball faces the opposite direction", () => {
    const playerShot = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ shooter: "player", progress: 0.5 }),
      80,
    )
    const opponentShot = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ shooter: "opponent", progress: 0.5 }),
      80,
    )

    expect(playerShot).toContain("▄█▀▀█")
    expect(opponentShot).toContain("█▀▀█▄")
    expect(playerShot).not.toEqual(opponentShot)
  })

  test("Given player and opponent shots When rendering travel Then fireballs move from opposite sides", () => {
    const playerStart = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ shooter: "player", progress: 0 }),
      80,
    )
    const playerEnd = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ shooter: "player", progress: 1 }),
      80,
    )
    const opponentStart = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ shooter: "opponent", progress: 0 }),
      80,
    )

    expect(playerStart).not.toEqual(playerEnd)
    expect(playerStart).not.toEqual(opponentStart)
    expect(EVOLUTION_BATTLE_HITS_TO_WIN).toBe(3)
  })

  test("Given battle progress When rendering Then visual score pips and hit result are shown", () => {
    const artwork = renderEvolutionBattleArtwork(
      MONSTER_FRAME_CATALOG,
      "agumon",
      "gabumon",
      defaultBattleScene({ playerHits: 2, opponentHits: 1, lastResult: "hit" }),
      80,
    )

    expect(buildBattleScorePips(2)).toBe("██░")
    expect(buildBattleScorePips(1)).toBe("█░░")
    expect(buildBattleScoreRow(2, 1)).toContain("██░")
    expect(buildBattleScoreRow(2, 1)).toContain("█░░")
    expect(artwork).toContain("HIT!")
  })

  test("Given planned player victory When battle ends Then player reaches three hits first", () => {
    const shots = planEvolutionBattle("player", () => 0.42)
    const { playerHits, opponentHits } = countHits(shots)

    expect(playerHits).toBe(EVOLUTION_BATTLE_HITS_TO_WIN)
    expect(opponentHits).toBeLessThan(EVOLUTION_BATTLE_HITS_TO_WIN)
  })

  test("Given planned opponent victory When battle ends Then opponent reaches three hits first", () => {
    const shots = planEvolutionBattle("opponent", () => 0.42)
    const { playerHits, opponentHits } = countHits(shots)

    expect(opponentHits).toBe(EVOLUTION_BATTLE_HITS_TO_WIN)
    expect(playerHits).toBeLessThan(EVOLUTION_BATTLE_HITS_TO_WIN)
  })
})
