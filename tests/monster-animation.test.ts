import { describe, expect, test } from "bun:test"

import { MonsterFrame } from "../src/data/monster-frame-catalog.ts"
import { MonsterAnimationController } from "../src/tui/monster-animation.ts"
import { catalogFor, frameContent, partnerChanged } from "./monster-animation-test-utils.ts"

describe("MonsterAnimationController identity", () => {
  test("Given no active partner When it is selected Then animation is blank at the centered origin", () => {
    const controller = new MonsterAnimationController(catalogFor(new Map()))

    const output = controller.dispatch(partnerChanged(undefined))

    expect(output).toEqual({ kind: "blank", result: { kind: "blank" }, offset: 0, facing: "left" })
    expect(controller.get()).toEqual({ kind: "blank" })
  })

  test.each(["unknown", ""])(
    "Given active %p artwork without walk frames When selected Then it is unavailable with the raw key",
    (sprite) => {
      const controller = new MonsterAnimationController(catalogFor(new Map()))

      const output = controller.dispatch(partnerChanged({ sprite, isDigitama: false }))

      expect(output).toEqual({
        kind: "unavailable",
        result: { kind: "unavailable", sprite },
        offset: 0,
        facing: "left",
      })
    },
  )

  test("Given an unavailable partner When every event occurs Then no hidden semantic motion accumulates", () => {
    const controller = new MonsterAnimationController(catalogFor(new Map()))
    const identity = { sprite: "missing", isDigitama: false } as const

    controller.dispatch(partnerChanged(identity))
    const ticked = controller.dispatch({ kind: "tick" })
    const active = controller.dispatch({ kind: "activity" })
    const resized = controller.dispatch({ kind: "viewport_resized", width: 80 })

    expect(ticked).toEqual(active)
    expect(active).toEqual(resized)
    expect(resized).toEqual({
      kind: "unavailable",
      result: { kind: "unavailable", sprite: "missing" },
      offset: 0,
      facing: "left",
    })
  })

  test("Given a non-Digitama partner with two walk frames When selected Then walking starts on walk_1 facing left", () => {
    const controller = new MonsterAnimationController(catalogFor(new Map([["agumon", ["angry", "walk_1", "walk_2"]]])))

    const output = controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))

    expect(output).toEqual({
      kind: "walking",
      result: { kind: "frame", frame: new MonsterFrame("agumon:walk_1") },
      offset: 0,
      facing: "left",
    })
  })

  test("Given a non-Digitama partner with only walk_2 When selected Then walking starts on its available walk frame", () => {
    const controller = new MonsterAnimationController(catalogFor(new Map([["sparse", ["happy", "walk_2"]]])))

    const output = controller.dispatch(partnerChanged({ sprite: "sparse", isDigitama: false }))

    expect(frameContent(output)).toBe("sparse:walk_2")
    expect(output.kind).toBe("walking")
  })

  test("Given a stage-zero identity with a non-egg sprite When ticks occur Then explicit Digitama mode loops walk frames at the origin", () => {
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["unexpected", ["angry", "walk_1", "walk_2"]]])),
    )

    const first = controller.dispatch(partnerChanged({ sprite: "unexpected", isDigitama: true }))
    const second = controller.dispatch({ kind: "tick" })
    const wrapped = controller.dispatch({ kind: "tick" })

    expect([first, second, wrapped].map(frameContent)).toEqual([
      "unexpected:walk_1",
      "unexpected:walk_2",
      "unexpected:walk_1",
    ])
    expect([first, second, wrapped].map(({ kind, offset, facing }) => ({ kind, offset, facing }))).toEqual([
      { kind: "digitama", offset: 0, facing: "left" },
      { kind: "digitama", offset: 0, facing: "left" },
      { kind: "digitama", offset: 0, facing: "left" },
    ])
  })

  test("Given a selected identity at its second frame When the same identity is selected Then its phase is preserved", () => {
    const controller = new MonsterAnimationController(catalogFor(new Map([["egg", ["walk_1", "walk_2"]]])))
    const identity = { sprite: "egg", isDigitama: true } as const

    controller.dispatch(partnerChanged(identity))
    controller.dispatch({ kind: "tick" })
    const preserved = controller.dispatch(partnerChanged(identity))

    expect(frameContent(preserved)).toBe("egg:walk_2")
  })

  test.each([
    ["sprite change", { sprite: "gatomon", isDigitama: false }],
    ["Digitama-status change", { sprite: "agumon", isDigitama: true }],
  ] as const)(
    "Given a walking partner at its second frame When its %s occurs Then all transient state resets",
    (_change, nextIdentity) => {
      const controller = new MonsterAnimationController(
        catalogFor(
          new Map([
            ["agumon", ["walk_1", "walk_2"]],
            ["gatomon", ["walk_1", "walk_2"]],
          ]),
        ),
      )

      controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
      controller.dispatch({ kind: "tick" })
      const reset = controller.dispatch(partnerChanged(nextIdentity))

      expect(frameContent(reset)).toBe(`${nextIdentity.sprite}:walk_1`)
      expect(reset.offset).toBe(0)
      expect(reset.facing).toBe("left")
    },
  )

  test("Given compatibility callers When sprite selection and advancement are used Then they observe semantic walk frames", () => {
    const controller = new MonsterAnimationController(catalogFor(new Map([["agumon", ["walk_1", "walk_2"]]])))

    controller.setSprite("agumon")
    const first = controller.get()
    controller.advance()
    const second = controller.get()

    expect(first).toEqual({ kind: "frame", frame: new MonsterFrame("agumon:walk_1") })
    expect(second).toEqual({ kind: "frame", frame: new MonsterFrame("agumon:walk_2") })
  })
})
