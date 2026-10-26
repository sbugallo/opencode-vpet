import {
  createMonsterFrame,
  createMonsterFrames,
  type MonsterFrame,
  MonsterFrameCatalog,
  type MonsterFrameName,
} from "../src/data/monster-frame-catalog.ts"
import {
  MonsterAnimationController,
  type MonsterAnimationEvent,
  type MonsterAnimationIdentity,
  type MonsterAnimationOutput,
} from "../src/tui/monster-animation.ts"

const FRAME_LABEL_LIMIT = 32

/**
 * Builds a distinct deterministic frame per `sprite:name` label by encoding
 * the label's bits into the pixel grid, so fixtures stay comparable with
 * `toEqual` and distinguishable from each other.
 */
export const labeledFrame = (sprite: string, name: MonsterFrameName): MonsterFrame => {
  const label = `${sprite}:${name}`
  if (label.length > FRAME_LABEL_LIMIT) throw new Error(`Frame label too long: ${label}`)
  const pixels = new Uint8Array(256).fill(1)
  for (let bit = 0; bit < label.length * 8; bit += 1) {
    const code = label.charCodeAt(bit >> 3)
    pixels[bit] = (code >> (7 - (bit & 7))) & 1 ? 2 : 1
  }
  return createMonsterFrame(pixels, [null, "#111111", "#222222"])
}

export const labelOfFrame = (frame: { readonly pixels: Uint8Array }): string => {
  let label = ""
  for (let byte = 0; byte < FRAME_LABEL_LIMIT; byte += 1) {
    let code = 0
    for (let bit = 0; bit < 8; bit += 1) code = (code << 1) | ((frame.pixels[byte * 8 + bit] ?? 1) - 1)
    if (code === 0) break
    label += String.fromCharCode(code)
  }
  return label
}

export const catalogFor = (sprites: ReadonlyMap<string, readonly MonsterFrameName[]>): MonsterFrameCatalog =>
  new MonsterFrameCatalog(
    new Map(
      Array.from(sprites, ([sprite, frameNames]) => {
        const frames: Partial<Record<MonsterFrameName, MonsterFrame>> = {}
        for (const name of frameNames) frames[name] = labeledFrame(sprite, name)
        return [sprite, createMonsterFrames(sprite, frames)] as const
      }),
    ),
  )

export const partnerChanged = (partner: MonsterAnimationIdentity | undefined): MonsterAnimationEvent => ({
  kind: "partner_changed",
  partner,
})

export const frameLabel = (output: MonsterAnimationOutput): string | undefined =>
  output.result.kind === "frame" ? labelOfFrame(output.result.frame) : undefined

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
