import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "../src/data/monster-frame-catalog.ts"
import { MONSTER_FRAME_DATA } from "../src/data/monster-frame-data.ts"

const AGUMON_WALK_1 =
  "      ▄▄▄▄▄     \n    ▄█ ▄▄  ▀▄   \n ▄▀▀   ▄██  ▀▄  \n ▀█▀▀        █  \n   ▀██▀▀  ▄ █   \n   █▄█   █▄▄ █  \n   ▄▄▀▀▄▄▄▄▀  █ \n  █▄█▄▄█ █▄█▄█▄█"
const SPACE_FAMILY_WALK_1 =
  " █▀▄ ▄▄▀▀█▀▄▄▄  \n ▀▄ ███▀█▀ █▄▄█ \n   ███▄▄██▀ ▄▀  \n   ▀▄▄  ██▄█▀█  \n    ▀▄▄██▀▄ ▀█  \n   ▄▀██ ██▀▀█▀  \n   ▀▄█▄▄▄█▄▄█   \n   █▄▄█ ▀█▄▄▄█  "
const UNDERSCORE_FAMILY_EAT_1 =
  "                \n                \n                \n                \n     ▄▄▄▄  ▄    \n    ▀██▄███▀    \n       ▀███     \n      ▄▄██▀▄    "
const EGG_WALK_2 =
  "                \n                \n                \n    ▄▄▀▀▀▀▄▄    \n  ▄██▀    ███▄  \n ▄▀ ▄▄     ▀▀▀▄ \n █▄ ▀███   ▄▄ █ \n  ▀█▄▄▄▄▄▄███▀  "
const AGUNIMON_REFUSE =
  " ▄▄    ▄▄▄▄     \n █ ▀▄██▄▄█ █▀▀▄ \n  ▀▄██▀ █▄▄▀▀█▀ \n   █▀▀▀▀▀█ ▄█▄  \n    █▀▀▀▄█▀▀▄█  \n    ▄██▀█▄█▄▄█  \n   █▄█▀ ▀█  █▄  \n▄ █▄▄█▀▀▀▀██▄▄█ "

describe("generated monster frame corpus", () => {
  test("Given the migrated corpus, when its sprite and frame entries are counted, then it retains every source directory and frame exactly once", () => {
    const spriteCount = MONSTER_FRAME_DATA.length
    const frameCount = MONSTER_FRAME_DATA.reduce((total, [, frames]) => total + frames.length, 0)

    expect(spriteCount).toBe(646)
    expect(frameCount).toBe(7227)
  })

  test("Given representative source filename families, when their canonical catalog keys are looked up, then the exact whitespace-sensitive artwork is returned", () => {
    expect(MONSTER_FRAME_CATALOG.get("agumon", "walk_1")?.content).toBe(AGUMON_WALK_1)
    expect(MONSTER_FRAME_CATALOG.get("agunimon", "walk_1")?.content).toBe(SPACE_FAMILY_WALK_1)
    expect(MONSTER_FRAME_CATALOG.get("giromon", "eat_1")?.content).toBe(UNDERSCORE_FAMILY_EAT_1)
    expect(MONSTER_FRAME_CATALOG.get("egg", "walk_2")?.content).toBe(EGG_WALK_2)
    expect(MONSTER_FRAME_CATALOG.get("agunimon", "refuse")?.content).toBe(AGUNIMON_REFUSE)
  })

  test("Given sparse, shared, empty, and unknown sprite keys, when frames are looked up directly, then catalog availability remains exact", () => {
    expect(MONSTER_FRAME_CATALOG.get("egg", "angry")).toBeUndefined()
    expect(MONSTER_FRAME_CATALOG.get("gatomon", "walk_1")?.content).toBeDefined()
    expect(MONSTER_FRAME_CATALOG.get("", "walk_1")).toBeUndefined()
    expect(MONSTER_FRAME_CATALOG.get("unknown", "walk_1")).toBeUndefined()
  })

  test("Given every generated frame, when its text shape is inspected, then it remains eight 16-code-point rows without a final newline", () => {
    for (const [, frames] of MONSTER_FRAME_DATA) {
      for (const [, content] of frames) {
        const lines = content.split("\n")

        expect(lines).toHaveLength(8)
        expect(content.endsWith("\n")).toBeFalse()
        for (const line of lines) {
          expect(Array.from(line)).toHaveLength(16)
        }
      }
    }
  })
})
