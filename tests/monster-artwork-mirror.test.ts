import { describe, expect, test } from "bun:test"

import { MonsterFrame, MONSTER_FRAME_CATALOG } from "../src/data/monster-frame-catalog.ts"
import { MONSTER_FRAME_DATA } from "../src/data/monster-frame-data.ts"
import { mirrorMonsterFrame } from "../src/tui/monster-artwork-mirror.ts"

const AGUMON_WALK_1_MIRROR =
  "     ▄▄▄▄▄      \n   ▄▀  ▄▄ █▄    \n  ▄▀  ██▄   ▀▀▄ \n  █        ▀▀█▀ \n   █ ▄  ▀▀██▀   \n  █ ▄▄█   █▄█   \n █  ▀▄▄▄▄▀▀▄▄   \n█▄█▄█▄█ █▄▄█▄█  "

const asymmetricFrame = new MonsterFrame(
  "()[]{}<>╱╲╭╮╰╯  \n                \n                \n                \n                \n                \n                \n                ",
)

describe("mirrorMonsterFrame", () => {
  test("Given Agumon's asymmetric walk frame When it is mirrored Then every row is exactly reversed with its trailing cells retained", () => {
    const source = MONSTER_FRAME_CATALOG.get("agumon", "walk_1")
    if (source === undefined) throw new Error("missing Agumon walk frame")

    const result = mirrorMonsterFrame(source)

    expect(result).toEqual({ kind: "mirrored", frame: new MonsterFrame(AGUMON_WALK_1_MIRROR) })
  })

  test("Given each asymmetric glyph pair When the frame is mirrored Then every glyph becomes its horizontal counterpart", () => {
    const result = mirrorMonsterFrame(asymmetricFrame)

    expect(result).toEqual({
      kind: "mirrored",
      frame: new MonsterFrame(
        "  ╰╯╭╮╱╲<>{}[]()\n                \n                \n                \n                \n                \n                \n                ",
      ),
    })
  })

  test("Given identity glyphs including block art and spaces When the frame is mirrored Then their code points remain unchanged", () => {
    const source = new MonsterFrame(
      " ▄█▀▄█▀ ▄█▀▄█▀  \n                \n                \n                \n                \n                \n                \n                ",
    )

    const result = mirrorMonsterFrame(source)

    expect(result).toEqual({
      kind: "mirrored",
      frame: new MonsterFrame(
        "  ▀█▄▀█▄ ▀█▄▀█▄ \n                \n                \n                \n                \n                \n                \n                ",
      ),
    })
  })

  test("Given a valid frame When it is mirrored Then the result is a new immutable eight-row 16-code-point frame", () => {
    const result = mirrorMonsterFrame(asymmetricFrame)

    if (result.kind === "invalid") throw new Error("expected valid fixture")

    expect(result.frame).not.toBe(asymmetricFrame)
    expect(Object.isFrozen(result)).toBeTrue()
    expect(Object.isFrozen(result.frame)).toBeTrue()
    expect(result.frame.content.split("\n")).toHaveLength(8)
    for (const row of result.frame.content.split("\n")) {
      expect(Array.from(row)).toHaveLength(16)
    }
  })

  test("Given a valid frame When it is mirrored twice Then its bytes and source value are unchanged", () => {
    const sourceContent = asymmetricFrame.content
    const once = mirrorMonsterFrame(asymmetricFrame)
    if (once.kind === "invalid") throw new Error("expected valid fixture")
    const twice = mirrorMonsterFrame(once.frame)

    expect(twice).toEqual({ kind: "mirrored", frame: new MonsterFrame(sourceContent) })
    expect(asymmetricFrame.content).toBe(sourceContent)
  })

  test("Given the production frame corpus When every frame is mirrored Then its fixed Unicode dimensions are retained", () => {
    for (const [, frames] of MONSTER_FRAME_DATA) {
      for (const [, content] of frames) {
        const result = mirrorMonsterFrame(new MonsterFrame(content))
        if (result.kind === "invalid") throw result.error

        const rows = result.frame.content.split("\n")
        expect(rows).toHaveLength(8)
        for (const row of rows) {
          expect(Array.from(row)).toHaveLength(16)
        }
      }
    }
  })

  test("Given a malformed frame with too few rows When it is mirrored Then the typed malformed-frame result reports its row count", () => {
    const result = mirrorMonsterFrame(
      new MonsterFrame(
        "                \n                \n                \n                \n                \n                \n                ",
      ),
    )

    if (result.kind === "mirrored") throw new Error("expected malformed fixture")

    expect(result.error.name).toBe("MalformedMonsterFrameError")
    expect(result.error.reason).toEqual({ kind: "row_count", actual: 7 })
  })

  test("Given a malformed frame with a short row When it is mirrored Then the typed malformed-frame result reports its row dimensions", () => {
    const result = mirrorMonsterFrame(
      new MonsterFrame(
        "               \n                \n                \n                \n                \n                \n                \n                ",
      ),
    )

    if (result.kind === "mirrored") throw new Error("expected malformed fixture")

    expect(result.error.reason).toEqual({ kind: "column_count", row: 0, actual: 15 })
  })

  test("Given a malformed frame with a trailing separator When it is mirrored Then the typed malformed-frame result reports its row count", () => {
    const result = mirrorMonsterFrame(
      new MonsterFrame(
        "                \n                \n                \n                \n                \n                \n                \n                \n",
      ),
    )

    if (result.kind === "mirrored") throw new Error("expected malformed fixture")

    expect(result.error.reason).toEqual({ kind: "row_count", actual: 9 })
  })
})
