import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { MonsterAnimationController } from "../src/webview/presentation/monster-animation.ts"

import { MONSTER_SLEEP_AFTER_MS } from "../src/shared/constants/presentation-timing.ts"

describe("monster animation", () => {
  test("returns blank when partner is cleared", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    controller.dispatch({ kind: "partner_changed", partner: { sprite: "agumon", isDigitama: false } })
    const output = controller.dispatch({ kind: "partner_changed", partner: undefined })
    expect(output.kind).toBe("blank")
    expect(output.result.kind).toBe("blank")
  })

  test("dispatches partner_changed into a walking frame", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    const output = controller.dispatch({
      kind: "partner_changed",
      partner: { sprite: "agumon", isDigitama: false },
    })
    expect(output.kind).toBe("walking")
    expect(output.result.kind).toBe("frame")
  })

  test("uses digitama state for stage zero partners", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    const output = controller.dispatch({
      kind: "partner_changed",
      partner: { sprite: "agumon", isDigitama: true },
    })
    expect(output.kind).toBe("digitama")
  })

  test("marks unknown sprites as unavailable", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    const output = controller.dispatch({
      kind: "partner_changed",
      partner: { sprite: "missing-sprite", isDigitama: false },
    })
    expect(output.kind).toBe("unavailable")
    expect(output.result.kind).toBe("unavailable")
  })

  test("keeps state when the same partner is dispatched again", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    const first = controller.dispatch({
      kind: "partner_changed",
      partner: { sprite: "agumon", isDigitama: false },
    })
    const second = controller.dispatch({
      kind: "partner_changed",
      partner: { sprite: "agumon", isDigitama: false },
    })
    expect(second).toEqual(first)
  })

  test("advances walking animation on tick", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG, () => 0.5)
    controller.dispatch({ kind: "partner_changed", partner: { sprite: "agumon", isDigitama: false } })
    const before = controller.output()
    const after = controller.dispatch({ kind: "tick" })
    expect(after.kind).toBe("walking")
    expect(after.result.kind).toBe("frame")
    if (before.result.kind === "frame" && after.result.kind === "frame") {
      expect(after !== before || after.offset !== before.offset || after.facing !== before.facing).toBe(true)
    }
  })

  test("resizes walking policy on viewport changes", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG, () => 0.5)
    controller.dispatch({ kind: "partner_changed", partner: { sprite: "agumon", isDigitama: false } })
    const resized = controller.dispatch({ kind: "viewport_resized", width: 80 })
    expect(resized.kind).toBe("walking")
  })

  test("enters sleeping state after inactivity timeout", () => {
    let now = 0
    const controller = new MonsterAnimationController(
      MONSTER_FRAME_CATALOG,
      () => 0.5,
      () => now,
    )
    controller.dispatch({ kind: "partner_changed", partner: { sprite: "agumon", isDigitama: false } })
    now = MONSTER_SLEEP_AFTER_MS
    const output = controller.dispatch({ kind: "tick" })
    expect(output.kind).toBe("sleeping")
  })

  test("wakes from sleeping on activity", () => {
    let now = 0
    const controller = new MonsterAnimationController(
      MONSTER_FRAME_CATALOG,
      () => 0.5,
      () => now,
    )
    controller.dispatch({ kind: "partner_changed", partner: { sprite: "agumon", isDigitama: false } })
    now = MONSTER_SLEEP_AFTER_MS
    controller.dispatch({ kind: "tick" })
    now = MONSTER_SLEEP_AFTER_MS + 1
    const output = controller.dispatch({ kind: "activity" })
    expect(output.kind).toBe("walking")
  })

  test("setSprite helper maps to partner_changed", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    controller.setSprite("agumon")
    expect(controller.get().kind).toBe("frame")
    controller.setSprite(undefined)
    expect(controller.get().kind).toBe("blank")
  })
})
