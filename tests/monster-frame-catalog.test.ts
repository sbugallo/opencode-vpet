import { describe, expect, test } from "bun:test"

import {
  MONSTER_FRAME_NAMES,
  MonsterFrame,
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
    | "attack"
    | "eat_1"
    | "eat_2"
    | "happy"
    | "injured_1"
    | "injured_2"
    | "refuse"
    | "sleep_1"
    | "sleep_2"
    | "walk_1"
    | "walk_2"
  >
> = true

const WALK_FRAME_CONTENT = "    AGUMON WALK"

describe("MonsterFrameCatalog", () => {
  test("Given canonical frame constants, when their animation sequence is read, then it uses the approved eleven-frame order without refuse", () => {
    expect(monsterFrameNamesAreExact).toBeTrue()
    expect(MONSTER_FRAME_NAMES).toEqual([
      "angry",
      "attack",
      "eat_1",
      "eat_2",
      "happy",
      "injured_1",
      "injured_2",
      "refuse",
      "sleep_1",
      "sleep_2",
      "walk_1",
      "walk_2",
    ])
    expect(STANDARD_ANIMATION_SEQUENCE).toEqual([
      "angry",
      "attack",
      "eat_1",
      "eat_2",
      "happy",
      "injured_1",
      "injured_2",
      "sleep_1",
      "sleep_2",
      "walk_1",
      "walk_2",
    ])
  })

  test("Given a catalog with Agumon's walk frame, when it is requested by raw sprite key and canonical name, then it returns the exact immutable frame", () => {
    const frame = new MonsterFrame(WALK_FRAME_CONTENT)
    const catalog = new MonsterFrameCatalog(
      new Map([["agumon", new Map<MonsterFrameName, MonsterFrame>([["walk_1", frame]])]]),
    )

    const result = catalog.get("agumon", "walk_1")

    expect(result).toBe(frame)
    expect(result?.content).toBe(WALK_FRAME_CONTENT)
    expect(Object.isFrozen(result)).toBeTrue()
  })

  test("Given a catalog without an unknown sprite, when that sprite frame is requested, then it returns undefined", () => {
    const catalog = new MonsterFrameCatalog(new Map())

    const result = catalog.get("unknown", "walk_1")

    expect(result).toBeUndefined()
  })

  test("Given a catalog with Agumon but no refuse frame, when its missing frame is requested, then it returns undefined", () => {
    const catalog = new MonsterFrameCatalog(new Map([["agumon", new Map<MonsterFrameName, MonsterFrame>()]]))

    const result = catalog.get("agumon", "refuse")

    expect(result).toBeUndefined()
  })
})
