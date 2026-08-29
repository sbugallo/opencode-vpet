import type { MonsterFrameCatalog, MonsterFrameName } from "../data/monster-frame-catalog.ts"

export type WalkingFacing = "left" | "right"
export type WalkFrame = "walk_1" | "walk_2"

type MovementBounds = { readonly left: number; readonly right: number }
type WalkingBout =
  | { readonly kind: "suspended" }
  | { readonly kind: "moving"; readonly remaining: number }
  | { readonly kind: "boundary_hold" | "queued_action" }

export type WalkingPolicyState = {
  readonly frameName: WalkFrame
  readonly offset: number
  readonly facing: WalkingFacing
  readonly bounds: MovementBounds | undefined
  readonly bout: WalkingBout
}

export type ActionBoundaryState = {
  readonly frameName: MonsterFrameName
  readonly offset: number
  readonly facing: WalkingFacing
  readonly bounds: MovementBounds | undefined
}

export type WalkingPolicyTick =
  | { readonly kind: "walking"; readonly walking: WalkingPolicyState }
  | { readonly kind: "action"; readonly action: ActionBoundaryState }

const assertNever = (value: never): never => {
  throw new Error(`Unexpected walking policy variant: ${JSON.stringify(value)}`)
}

export const initialWalkingPolicy = (frameName: WalkFrame): WalkingPolicyState => ({
  frameName,
  offset: 0,
  facing: "left",
  bounds: undefined,
  bout: { kind: "suspended" },
})

export const tickWalkingPolicy = (
  state: WalkingPolicyState,
  sprite: string,
  catalog: MonsterFrameCatalog,
): WalkingPolicyTick => {
  switch (state.bout.kind) {
    case "suspended":
      return { kind: "walking", walking: { ...state, frameName: nextWalkFrame(state.frameName, sprite, catalog) } }
    case "moving": {
      const frameName = nextWalkFrame(state.frameName, sprite, catalog)
      const walking = {
        ...state,
        frameName,
        offset: state.offset + (state.facing === "left" ? -1 : 1),
      }
      if (state.bout.remaining > 1) {
        return {
          kind: "walking",
          walking: { ...walking, bout: { kind: "moving", remaining: state.bout.remaining - 1 } },
        }
      }
      const bout =
        frameName === "walk_1" && catalog.get(sprite, "walk_2") !== undefined
          ? ({ kind: "boundary_hold" } as const)
          : ({ kind: "queued_action" } as const)
      return { kind: "walking", walking: { ...walking, bout } }
    }
    case "boundary_hold":
      return { kind: "walking", walking: { ...state, frameName: "walk_2", bout: { kind: "queued_action" } } }
    case "queued_action":
      return { kind: "action", action: state }
    default:
      return assertNever(state.bout)
  }
}

export const resizeWalkingPolicy = (
  state: WalkingPolicyState,
  width: number,
  random: () => number,
): WalkingPolicyState => {
  const bounds = movementBounds(width)
  if (bounds === undefined) return { ...state, offset: 0, bounds: undefined, bout: { kind: "suspended" } }
  const offset = Math.min(bounds.right, Math.max(bounds.left, state.offset))
  const resized = { ...state, offset, bounds }
  switch (state.bout.kind) {
    case "boundary_hold":
    case "queued_action":
      return resized
    case "moving":
    case "suspended":
      return planBout({ ...resized, bout: { kind: "suspended" } }, random)
    default:
      return assertNever(state.bout)
  }
}

export const resizeActionBoundary = (state: ActionBoundaryState, width: number): ActionBoundaryState => {
  const bounds = movementBounds(width)
  if (bounds === undefined) return { ...state, offset: 0, bounds: undefined }
  return { ...state, offset: Math.min(bounds.right, Math.max(bounds.left, state.offset)), bounds }
}

export const resumeWalkingPolicy = (state: ActionBoundaryState, random: () => number): WalkingPolicyState => {
  const bounds = state.bounds
  const frameName = state.frameName === "walk_2" ? "walk_2" : "walk_1"
  if (bounds === undefined) return { ...state, frameName, bout: { kind: "suspended" } }
  const atFacingEdge = state.facing === "left" ? state.offset === bounds.left : state.offset === bounds.right
  const facing = atFacingEdge ? (state.facing === "left" ? "right" : "left") : state.facing
  return planBout({ ...state, frameName, facing, bounds, bout: { kind: "suspended" } }, random)
}

export const restartWalkingPolicy = (
  state: ActionBoundaryState,
  frameName: WalkFrame,
  random: () => number,
): WalkingPolicyState => {
  const walking = { ...state, frameName, bout: { kind: "suspended" } } as const
  return state.bounds === undefined ? walking : planBout(walking, random)
}

const nextWalkFrame = (current: WalkFrame, sprite: string, catalog: MonsterFrameCatalog): WalkFrame => {
  const alternate = current === "walk_1" ? "walk_2" : "walk_1"
  return catalog.get(sprite, alternate) === undefined ? current : alternate
}

const movementBounds = (width: number): MovementBounds | undefined => {
  if (!Number.isFinite(width) || width < 16) return undefined
  const free = Math.floor(width) - 16
  return { left: -Math.floor(free / 2), right: Math.ceil(free / 2) }
}

const planBout = (state: WalkingPolicyState, random: () => number): WalkingPolicyState => {
  const bounds = state.bounds
  if (bounds === undefined) return { ...state, bout: { kind: "suspended" } }
  const available = state.facing === "left" ? state.offset - bounds.left : bounds.right - state.offset
  if (available === 0) {
    return { ...state, bout: { kind: bounds.left === bounds.right ? "suspended" : "queued_action" } }
  }
  const remaining = available < 5 ? available : 5 + Math.floor(normalizedRandom(random) * (available - 4))
  return { ...state, bout: { kind: "moving", remaining } }
}

const normalizedRandom = (random: () => number): number => {
  const sample = random()
  if (!Number.isFinite(sample) || sample <= 0) return 0
  return sample >= 1 ? 1 - Number.EPSILON : sample
}
