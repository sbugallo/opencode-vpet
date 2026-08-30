import { describe, expect, test } from "bun:test"

import { MonsterAnimationController } from "../src/tui/monster-animation.ts"
import { resizeWalkingPolicy, type WalkingPolicyState } from "../src/tui/monster-walking-policy.ts"
import {
  catalogFor,
  frameContent,
  partnerChanged,
  sequenceRandom,
  walkingController,
} from "./monster-animation-test-utils.ts"

describe("MonsterAnimationController walking", () => {
  test("Given a deterministic five-cell bout When walking ticks occur Then each legal tick moves one cell and alternates frames", () => {
    const source = sequenceRandom(0)
    const controller = walkingController(source.random)
    controller.dispatch({ kind: "viewport_resized", width: 40 })

    const outputs = Array.from({ length: 5 }, () => controller.dispatch({ kind: "tick" }))

    expect(outputs.map(({ offset }) => offset)).toEqual([-1, -2, -3, -4, -5])
    expect(outputs.map(frameContent)).toEqual([
      "agumon:walk_2",
      "agumon:walk_1",
      "agumon:walk_2",
      "agumon:walk_1",
      "agumon:walk_2",
    ])
    expect(source.calls()).toBe(1)
  })

  test("Given width 40 observed while blank When a non-Digitama partner changes Then the reset walking state moves on its first tick", () => {
    const source = sequenceRandom(0)
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["agumon", ["walk_1", "walk_2"]]])),
      source.random,
    )

    controller.dispatch({ kind: "viewport_resized", width: 40 })
    const reset = controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
    const moved = controller.dispatch({ kind: "tick" })

    expect(reset).toMatchObject({ kind: "walking", offset: 0, facing: "left" })
    expect(frameContent(reset)).toBe("agumon:walk_1")
    expect(moved).toMatchObject({ kind: "walking", offset: -1, facing: "left" })
    expect(source.calls()).toBe(1)
  })

  test("Given width 40 observed while Digitama is active When a non-Digitama partner changes Then Digitama stays RNG-free and the replacement moves without another resize", () => {
    const source = sequenceRandom(0)
    const controller = new MonsterAnimationController(
      catalogFor(
        new Map([
          ["egg", ["walk_1", "walk_2"]],
          ["agumon", ["walk_1", "walk_2"]],
        ]),
      ),
      source.random,
    )

    controller.dispatch(partnerChanged({ sprite: "egg", isDigitama: true }))
    const digitama = controller.dispatch({ kind: "viewport_resized", width: 40 })
    const reset = controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
    const moved = controller.dispatch({ kind: "tick" })

    expect(digitama).toMatchObject({ kind: "digitama", offset: 0, facing: "left" })
    expect(reset).toMatchObject({ kind: "walking", offset: 0, facing: "left" })
    expect(moved).toMatchObject({ kind: "walking", offset: -1, facing: "left" })
    expect(source.calls()).toBe(1)
  })

  test("Given a partner before any viewport observation When the viewport becomes valid Then existing suspended initialization resumes only after resizing", () => {
    const source = sequenceRandom(0)
    const controller = walkingController(source.random)

    const suspended = controller.dispatch({ kind: "tick" })
    const resized = controller.dispatch({ kind: "viewport_resized", width: 40 })
    const moved = controller.dispatch({ kind: "tick" })

    expect(suspended).toMatchObject({ kind: "walking", offset: 0, facing: "left" })
    expect(resized).toMatchObject({ kind: "walking", offset: 0, facing: "left" })
    expect(moved).toMatchObject({ kind: "walking", offset: -1, facing: "left" })
    expect(source.calls()).toBe(1)
  })

  test.each([15, Number.NaN, Number.POSITIVE_INFINITY])(
    "Given raw viewport width %p replaces a prior valid observation while blank When a non-Digitama partner changes Then its replacement remains suspended without movement RNG",
    (width) => {
      const source = sequenceRandom(0)
      const controller = new MonsterAnimationController(
        catalogFor(new Map([["agumon", ["walk_1", "walk_2"]]])),
        source.random,
      )

      controller.dispatch({ kind: "viewport_resized", width: 40 })
      controller.dispatch({ kind: "viewport_resized", width })
      const reset = controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
      const ticked = controller.dispatch({ kind: "tick" })

      expect(reset).toMatchObject({ kind: "walking", offset: 0, facing: "left" })
      expect(ticked).toMatchObject({ kind: "walking", offset: 0, facing: "left" })
      expect(source.calls()).toBe(0)
    },
  )

  test("Given a moving partner When the same identity is selected Then its planned bout and RNG state are preserved", () => {
    const source = sequenceRandom(0)
    const controller = walkingController(source.random)
    const identity = { sprite: "agumon", isDigitama: false } as const

    controller.dispatch({ kind: "viewport_resized", width: 40 })
    controller.dispatch({ kind: "tick" })
    const preserved = controller.dispatch(partnerChanged(identity))
    const moved = controller.dispatch({ kind: "tick" })

    expect(preserved).toMatchObject({ kind: "walking", offset: -1, facing: "left" })
    expect(moved).toMatchObject({ kind: "walking", offset: -2, facing: "left" })
    expect(source.calls()).toBe(1)
  })

  test.each([
    [39, -11, 12],
    [40, -12, 12],
  ])(
    "Given viewport width %i When full-distance bouts reach both edges Then signed bounds are [%i, %i]",
    (width, left, right) => {
      const source = sequenceRandom(0.999_999, 0, 0.999_999, 0)
      const controller = walkingController(source.random)
      controller.dispatch({ kind: "viewport_resized", width })

      const leftTrace = Array.from({ length: Math.abs(left) }, () => controller.dispatch({ kind: "tick" }))
      if (Math.abs(left) % 2 === 0) controller.dispatch({ kind: "tick" })
      const leftBoundary = controller.dispatch({ kind: "tick" })
      controller.dispatch({ kind: "tick" })
      const reversed = controller.dispatch({ kind: "tick" })
      const firstRightStep = controller.dispatch({ kind: "tick" })
      const rightTrace = Array.from({ length: right - left - 1 }, () => controller.dispatch({ kind: "tick" }))

      expect(leftTrace[leftTrace.length - 1]?.offset).toBe(left)
      expect(leftBoundary.kind).toBe("action")
      expect(reversed).toMatchObject({ kind: "walking", offset: left, facing: "right" })
      expect(firstRightStep).toMatchObject({ kind: "walking", offset: left + 1, facing: "right" })
      expect(rightTrace[rightTrace.length - 1]?.offset).toBe(right)
      expect(
        [...leftTrace, leftBoundary, reversed, firstRightStep, ...rightTrace].every(
          ({ offset }) => offset >= left && offset <= right,
        ),
      ).toBeTrue()
      expect(source.calls()).toBe(3)
    },
  )

  test.each([
    [17, 1],
    [18, -1],
    [23, -3],
  ])(
    "Given width %i with fewer than five cells toward the active edge When a bout is selected Then the exact remainder %i is traversed",
    (width, edge) => {
      const source = sequenceRandom(0.5)
      const controller = new MonsterAnimationController(
        catalogFor(new Map([["agumon", ["walk_1", "walk_2"]]])),
        source.random,
      )
      controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))

      controller.dispatch({ kind: "viewport_resized", width })
      const tickCount = width === 17 ? 5 : Math.abs(edge)
      const traversed = Array.from({ length: tickCount }, () => controller.dispatch({ kind: "tick" }))

      expect(traversed.some(({ offset }) => offset === edge)).toBeTrue()
      expect(source.calls()).toBe(0)
    },
  )

  test("Given a bout that completes on walk_1 When the boundary advances Then walk_2 is held without movement before the action", () => {
    const controller = walkingController(sequenceRandom(1).random)
    controller.dispatch({ kind: "viewport_resized", width: 28 })

    const moved = Array.from({ length: 6 }, () => controller.dispatch({ kind: "tick" }))
    const held = controller.dispatch({ kind: "tick" })
    const action = controller.dispatch({ kind: "tick" })

    expect(frameContent(moved[moved.length - 1] ?? held)).toBe("agumon:walk_1")
    expect(held).toMatchObject({ kind: "walking", offset: -6 })
    expect(frameContent(held)).toBe("agumon:walk_2")
    expect(action).toMatchObject({ kind: "action", offset: -6, facing: "left" })
  })

  test.each([0, 15, 16])(
    "Given viewport width %i When ticks occur Then movement is pinned without consuming RNG",
    (width) => {
      const source = sequenceRandom(0)
      const controller = walkingController(source.random)

      controller.dispatch({ kind: "viewport_resized", width })
      const outputs = Array.from({ length: 4 }, () => controller.dispatch({ kind: "tick" }))

      expect(outputs.every(({ offset }) => offset === 0)).toBeTrue()
      expect(source.calls()).toBe(0)
    },
  )

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "Given malformed viewport width %p When ticks occur Then coordinates safely remain suspended",
    (width) => {
      const source = sequenceRandom(0)
      const controller = walkingController(source.random)

      const resized = controller.dispatch({ kind: "viewport_resized", width })
      const ticked = controller.dispatch({ kind: "tick" })

      expect([resized, ticked].every(({ offset }) => offset === 0)).toBeTrue()
      expect(source.calls()).toBe(0)
    },
  )

  test("Given walking was suspended by a narrow viewport When resized validly Then one bout is selected and movement resumes", () => {
    const source = sequenceRandom(0)
    const controller = walkingController(source.random)
    controller.dispatch({ kind: "viewport_resized", width: 15 })
    controller.dispatch({ kind: "tick" })

    const resized = controller.dispatch({ kind: "viewport_resized", width: 26 })
    const moved = controller.dispatch({ kind: "tick" })

    expect(resized.offset).toBe(0)
    expect(moved.offset).toBe(-1)
    expect(source.calls()).toBe(1)
  })

  test("Given an active bout When the viewport shrinks and expands Then position is clamped and each resize replans without stale distance", () => {
    const source = sequenceRandom(0.999_999, 0, 0, 0)
    const controller = walkingController(source.random)
    controller.dispatch({ kind: "viewport_resized", width: 40 })
    Array.from({ length: 8 }, () => controller.dispatch({ kind: "tick" }))

    const shrunk = controller.dispatch({ kind: "viewport_resized", width: 20 })
    const boundary = controller.dispatch({ kind: "tick" })
    controller.dispatch({ kind: "tick" })
    const reversed = controller.dispatch({ kind: "tick" })
    const moved = controller.dispatch({ kind: "tick" })
    const expanded = controller.dispatch({ kind: "viewport_resized", width: 40 })

    expect(shrunk).toMatchObject({ kind: "walking", offset: -2, facing: "left" })
    expect(boundary).toMatchObject({ kind: "action", offset: -2, facing: "left" })
    expect(reversed).toMatchObject({ offset: -2, facing: "right" })
    expect(moved).toMatchObject({ offset: -1, facing: "right" })
    expect(expanded).toMatchObject({ offset: -1, facing: "right" })
    expect(source.calls()).toBe(3)
  })

  test.each([
    ["boundary_hold", -6, 20, -2],
    ["queued_action", -5, 40, -5],
  ] as const)(
    "Given a pending %s When resized validly Then it preserves the boundary without replanning or RNG",
    (kind, offset, width, expectedOffset) => {
      const source = sequenceRandom(0.75)
      const pending: WalkingPolicyState = {
        frameName: kind === "boundary_hold" ? "walk_1" : "walk_2",
        offset,
        facing: "left",
        bounds: { left: -6, right: 6 },
        bout: { kind },
      }

      const resized = resizeWalkingPolicy(pending, width, source.random)

      expect(resized).toMatchObject({ offset: expectedOffset, facing: "left", bout: { kind } })
      expect(resized.frameName).toBe(pending.frameName)
      expect(source.calls()).toBe(0)
    },
  )

  test("Given Digitama mode When malformed and valid viewport events and ticks occur Then it remains centered and consumes no RNG", () => {
    const source = sequenceRandom(0)
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["egg", ["walk_1", "walk_2"]]])),
      source.random,
    )
    controller.dispatch(partnerChanged({ sprite: "egg", isDigitama: true }))

    const outputs = [0, 15, 16, 80].flatMap((width) => [
      controller.dispatch({ kind: "viewport_resized", width }),
      controller.dispatch({ kind: "tick" }),
    ])

    expect(
      outputs.every(({ kind, offset, facing }) => kind === "digitama" && offset === 0 && facing === "left"),
    ).toBeTrue()
    expect(source.calls()).toBe(0)
  })
})
