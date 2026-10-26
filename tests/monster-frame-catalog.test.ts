import { describe, expect, test } from "bun:test"
import { deflateSync } from "node:zlib"

import {
  createMonsterFrame,
  createMonsterFrames,
  decodeMonsterSprite,
  MONSTER_FRAME_CATALOG,
  MONSTER_FRAME_NAMES,
  MonsterFrameCatalog,
  STANDARD_ANIMATION_SEQUENCE,
  type MonsterFrameName,
} from "../src/data/monster-frame-catalog.ts"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false

type Assert<Value extends true> = Value

const monsterFrameNamesAreExact: Assert<
  Equal<
    MonsterFrameName,
    | "angry"
    | "attack_1"
    | "attack_2"
    | "eat_1"
    | "eat_2"
    | "happy"
    | "refuse"
    | "sick"
    | "sleep_1"
    | "sleep_2"
    | "walk_1"
    | "walk_2"
  >
> = true

/** Encodes a two-color 16x16 sprite blob in the generated-data format. */
const fixtureBlob = (): string => {
  const raw = Buffer.alloc(2 + 3 + 256 * 2)
  raw.writeUInt16BE(1, 0)
  raw[2] = 0xab
  raw[3] = 0xcd
  raw[4] = 0xef
  // walk_1: every pixel palette index 1; walk_2: transparent everywhere.
  raw.fill(1, 2 + 3, 2 + 3 + 256)
  return deflateSync(raw).toString("base64")
}

describe("MonsterFrameCatalog", () => {
  test("Given canonical frame constants, when the animation sequence is read, then it uses the approved order without refuse", () => {
    expect(monsterFrameNamesAreExact).toBeTrue()
    expect(MONSTER_FRAME_NAMES).toEqual([
      "angry",
      "attack_1",
      "attack_2",
      "eat_1",
      "eat_2",
      "happy",
      "refuse",
      "sick",
      "sleep_1",
      "sleep_2",
      "walk_1",
      "walk_2",
    ])
    expect(STANDARD_ANIMATION_SEQUENCE).toEqual([
      "angry",
      "attack_1",
      "attack_2",
      "eat_1",
      "eat_2",
      "happy",
      "sick",
      "sleep_1",
      "sleep_2",
      "walk_1",
      "walk_2",
    ])
  })

  test("Given a generated sprite blob, when it is decoded, then the palette and palette-indexed pixels round-trip", () => {
    const frames = decodeMonsterSprite("fixture", ["walk_1", "walk_2"], fixtureBlob())

    expect(frames.sprite).toBe("fixture")
    expect(Object.keys(frames.frames).sort()).toEqual(["walk_1", "walk_2"])

    const walk = frames.frames.walk_1
    if (walk === undefined) throw new Error("Expected walk_1")
    expect(walk.palette).toEqual([null, "#abcdef"])
    expect(walk.pixels).toHaveLength(256)
    expect(walk.pixels.every((value) => value === 1)).toBeTrue()
    expect(frames.frames.walk_2?.pixels.every((value) => value === 0)).toBeTrue()
  })

  test("Given a blob carrying an unknown pose name, when it is decoded, then it fails loudly", () => {
    expect(() => decodeMonsterSprite("fixture", ["dancing"], fixtureBlob())).toThrow(/unknown frame/i)
  })

  test("Given a catalog with Agumon's walk frame, when it is requested by sprite key and canonical name, then it returns the exact frame", () => {
    const frame = createMonsterFrame(new Uint8Array(256).fill(1), [null, "#ffffff"])
    const catalog = new MonsterFrameCatalog(new Map([["agumon", createMonsterFrames("agumon", { walk_1: frame })]]))

    const result = catalog.get("agumon", "walk_1")

    expect(result).toBe(frame)
    expect(result?.palette).toEqual([null, "#ffffff"])
  })

  test("Given a catalog without an unknown sprite, when that sprite frame is requested, then it returns undefined", () => {
    const catalog = new MonsterFrameCatalog(new Map())

    expect(catalog.get("unknown", "walk_1")).toBeUndefined()
    expect(catalog.frames("unknown")).toBeUndefined()
  })

  test("Given a catalog sprite without a refuse frame, when its missing frame is requested, then it returns undefined", () => {
    const catalog = new MonsterFrameCatalog(
      new Map([
        [
          "agumon",
          createMonsterFrames("agumon", {
            walk_1: createMonsterFrame(new Uint8Array(256), [null]),
            walk_2: createMonsterFrame(new Uint8Array(256), [null]),
          }),
        ],
      ]),
    )

    expect(catalog.get("agumon", "refuse")).toBeUndefined()
  })

  test("Given malformed pixel data, when a frame is constructed, then the pixel-count invariant fails loudly", () => {
    expect(() => createMonsterFrame(new Uint8Array(255), [null])).toThrow(/256 pixels/)
  })

  test("Given the production catalog, when sprites are requested lazily, then real monsters decode and unknown sprites stay undefined", () => {
    const agumon = MONSTER_FRAME_CATALOG.frames("agumon")
    expect(agumon?.frames.walk_1).toBeDefined()
    expect(agumon?.frames.walk_2).toBeDefined()
    expect(agumon?.frames.attack_1).toBeDefined()
    expect(agumon?.frames.attack_2).toBeDefined()
    expect(MONSTER_FRAME_CATALOG.get("agumon", "walk_1")).toBe(agumon?.frames.walk_1)
    expect(MONSTER_FRAME_CATALOG.frames("digitama-deep-savers")?.frames.angry).toBeUndefined()
    expect(MONSTER_FRAME_CATALOG.frames("does-not-exist")).toBeUndefined()
  })
})
