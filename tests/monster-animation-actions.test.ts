import { describe, expect, test } from "bun:test"

import type { MonsterFrameName } from "../src/data/monster-frame-catalog.ts"
import { MonsterAnimationController } from "../src/tui/monster-animation.ts"
import {
  catalogFor,
  controlledClock,
  enterAction,
  frameContent,
  partnerChanged,
  sequenceRandom,
} from "./monster-animation-test-utils.ts"

describe("MonsterAnimationController actions and inactivity", () => {
  test.each([
    [0, "angry"],
    [0.25, "attack"],
    [0.5, "happy"],
    [0.75, "injured_1"],
  ] as const)(
    "Given four available cosmetic clips When action RNG is %p Then %s is selected uniformly",
    (sample, expectedFrame) => {
      const controller = new MonsterAnimationController(
        catalogFor(
          new Map([
            [
              "agumon",
              ["angry", "attack", "eat_1", "happy", "injured_1", "injured_2", "refuse", "sleep_1", "walk_1", "walk_2"],
            ],
          ]),
        ),
        sequenceRandom(sample).random,
        controlledClock().nowMs,
      )
      controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))

      const action = enterAction(controller)

      expect(action.kind).toBe("action")
      expect(frameContent(action)).toBe(`agumon:${expectedFrame}`)
    },
  )

  test.each([
    ["angry", ["angry", "angry"]],
    ["injured", ["injured_1", "injured_2"]],
    ["partial injured", ["injured_2", "injured_2"]],
  ] as const)(
    "Given a %s action clip When it plays Then it occupies exactly two ticks before walking resumes",
    (_case, expectedFrames) => {
      const frames: readonly MonsterFrameName[] =
        _case === "angry"
          ? ["angry", "walk_1", "walk_2"]
          : _case === "injured"
            ? ["injured_1", "injured_2", "walk_1", "walk_2"]
            : ["injured_2", "walk_1", "walk_2"]
      const controller = new MonsterAnimationController(
        catalogFor(new Map([["sparse", frames]])),
        sequenceRandom(0).random,
        controlledClock().nowMs,
      )
      controller.dispatch(partnerChanged({ sprite: "sparse", isDigitama: false }))

      const first = enterAction(controller)
      const second = controller.dispatch({ kind: "tick" })
      const resumed = controller.dispatch({ kind: "tick" })

      expect([first, second].map(frameContent)).toEqual(expectedFrames.map((name: string) => `sparse:${name}`))
      expect(
        [first, second].every(({ kind, offset, facing }) => kind === "action" && offset === 0 && facing === "left"),
      ).toBeTrue()
      expect(resumed).toMatchObject({ kind: "walking", offset: 0, facing: "right" })
    },
  )

  test("Given no cosmetic action clips When a bout completes Then another walking bout starts without unrelated fallback", () => {
    const source = sequenceRandom(0.5)
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["plain", ["eat_1", "eat_2", "refuse", "sleep_1", "walk_1", "walk_2"]]])),
      source.random,
      controlledClock().nowMs,
    )
    controller.dispatch(partnerChanged({ sprite: "plain", isDigitama: false }))

    const resumed = enterAction(controller)

    expect(resumed).toMatchObject({ kind: "walking", offset: 0, facing: "right" })
    expect(frameContent(resumed)).toBe("plain:walk_1")
    expect(source.calls()).toBe(0)
  })

  test("Given an awake monster When inactivity reaches the exact threshold Then sleep wins before walk progression", () => {
    const clock = controlledClock()
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["agumon", ["sleep_1", "sleep_2", "walk_1", "walk_2"]]])),
      sequenceRandom(0).random,
      clock.nowMs,
    )
    controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
    controller.dispatch({ kind: "viewport_resized", width: 40 })
    clock.set(299_999)

    const awake = controller.dispatch({ kind: "tick" })
    clock.set(300_000)
    const asleep = controller.dispatch({ kind: "tick" })
    const sleepingNext = controller.dispatch({ kind: "tick" })

    expect(awake).toMatchObject({ kind: "walking", offset: -1 })
    expect(asleep).toMatchObject({ kind: "sleeping", offset: -1, facing: "left" })
    expect([frameContent(asleep), frameContent(sleepingNext)]).toEqual(["agumon:sleep_1", "agumon:sleep_2"])
  })

  test("Given activity at the sleep boundary When the next tick occurs Then activity wins and resets inactivity", () => {
    const clock = controlledClock()
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["agumon", ["sleep_1", "walk_1", "walk_2"]]])),
      sequenceRandom(0).random,
      clock.nowMs,
    )
    controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
    controller.dispatch({ kind: "viewport_resized", width: 40 })
    clock.set(300_000)

    const active = controller.dispatch({ kind: "activity" })
    const ticked = controller.dispatch({ kind: "tick" })

    expect(active.kind).toBe("walking")
    expect(ticked).toMatchObject({ kind: "walking", offset: -1 })
  })

  test.each([
    ["one sleep frame", ["sleep_2", "walk_1", "walk_2"], ["sleep_2", "sleep_2"]],
    ["no sleep frames", ["walk_1", "walk_2"], ["walk_1", "walk_1"]],
  ] as const)(
    "Given %s When inactivity reaches the threshold Then sleeping remains sparse-safe",
    (_case, frames, expectedFrames) => {
      const clock = controlledClock()
      const controller = new MonsterAnimationController(
        catalogFor(new Map([["sparse", frames]])),
        sequenceRandom(0).random,
        clock.nowMs,
      )
      controller.dispatch(partnerChanged({ sprite: "sparse", isDigitama: false }))
      clock.set(300_000)

      const first = controller.dispatch({ kind: "tick" })
      const second = controller.dispatch({ kind: "tick" })

      expect([first.kind, second.kind]).toEqual(["sleeping", "sleeping"])
      expect([frameContent(first), frameContent(second)]).toEqual(
        expectedFrames.map((name: string) => `sparse:${name}`),
      )
    },
  )

  test("Given a sleeping monster away from an edge When activity occurs Then it wakes immediately with preserved placement and a fresh bout", () => {
    const clock = controlledClock()
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["agumon", ["sleep_1", "walk_1", "walk_2"]]])),
      sequenceRandom(0, 0).random,
      clock.nowMs,
    )
    controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
    controller.dispatch({ kind: "viewport_resized", width: 40 })
    controller.dispatch({ kind: "tick" })
    clock.set(300_000)
    controller.dispatch({ kind: "tick" })

    const woke = controller.dispatch({ kind: "activity" })
    const moved = controller.dispatch({ kind: "tick" })

    expect(woke).toMatchObject({ kind: "walking", offset: -1, facing: "left" })
    expect(frameContent(woke)).toBe("agumon:walk_1")
    expect(moved).toMatchObject({ kind: "walking", offset: -2, facing: "left" })
  })

  test("Given Digitama mode When time, activity, viewport, and ticks advance Then clock and RNG sleep/action behavior remain unused", () => {
    const source = sequenceRandom(0)
    const clock = controlledClock()
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["egg", ["angry", "sleep_1", "walk_1", "walk_2"]]])),
      source.random,
      clock.nowMs,
    )
    controller.dispatch(partnerChanged({ sprite: "egg", isDigitama: true }))
    clock.set(900_000)

    const active = controller.dispatch({ kind: "activity" })
    const resized = controller.dispatch({ kind: "viewport_resized", width: 80 })
    const ticked = controller.dispatch({ kind: "tick" })

    expect([active.kind, resized.kind, ticked.kind]).toEqual(["digitama", "digitama", "digitama"])
    expect(source.calls()).toBe(0)
    expect(clock.calls()).toBe(0)
  })
})
