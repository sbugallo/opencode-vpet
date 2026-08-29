import { MonsterFrame, MonsterFrameCatalog, type MonsterFrameName } from "../src/data/monster-frame-catalog.ts"
import {
  MonsterAnimationController,
  type MonsterAnimationEvent,
  type MonsterAnimationIdentity,
  type MonsterAnimationOutput,
} from "../src/tui/monster-animation.ts"

export const catalogFor = (sprites: ReadonlyMap<string, readonly MonsterFrameName[]>): MonsterFrameCatalog =>
  new MonsterFrameCatalog(
    Array.from(sprites, ([sprite, frameNames]) => [
      sprite,
      frameNames.map((name): readonly [MonsterFrameName, MonsterFrame] => [
        name,
        new MonsterFrame(`${sprite}:${name}`),
      ]),
    ]),
  )

export const partnerChanged = (partner: MonsterAnimationIdentity | undefined): MonsterAnimationEvent => ({
  kind: "partner_changed",
  partner,
})

export const frameContent = (output: MonsterAnimationOutput): string | undefined =>
  output.result.kind === "frame" ? output.result.frame.content : undefined

export const sequenceRandom = (...values: readonly number[]) => {
  let calls = 0
  return { random: (): number => values[calls++] ?? 0, calls: (): number => calls }
}

export const controlledClock = (initialMs = 0) => {
  let currentMs = initialMs
  let calls = 0
  return {
    nowMs: (): number => {
      calls += 1
      return currentMs
    },
    set: (nextMs: number): void => {
      currentMs = nextMs
    },
    calls: (): number => calls,
  }
}

export const enterAction = (controller: MonsterAnimationController): MonsterAnimationOutput => {
  controller.dispatch({ kind: "viewport_resized", width: 17 })
  return controller.dispatch({ kind: "tick" })
}

export const walkingController = (random: () => number): MonsterAnimationController => {
  const controller = new MonsterAnimationController(
    catalogFor(new Map([["agumon", ["angry", "walk_1", "walk_2"]]])),
    random,
  )
  controller.dispatch(partnerChanged({ sprite: "agumon", isDigitama: false }))
  return controller
}
