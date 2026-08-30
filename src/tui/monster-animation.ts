import type { MonsterFrame, MonsterFrameCatalog, MonsterFrameName } from "../data/monster-frame-catalog.ts"
import {
  resolveCosmeticActions,
  resolveSleepClip,
  selectCosmeticAction,
  type CosmeticActionClip,
  type SleepClip,
} from "./monster-action-policy.ts"
import {
  initialWalkingPolicy,
  resizeActionBoundary,
  resizeWalkingPolicy,
  restartWalkingPolicy,
  resumeWalkingPolicy,
  tickWalkingPolicy,
  type ActionBoundaryState,
  type WalkFrame,
  type WalkingFacing,
  type WalkingPolicyState,
} from "./monster-walking-policy.ts"

export type MonsterAnimationIdentity = {
  readonly sprite: string
  readonly isDigitama: boolean
}

export type MonsterAnimationEvent =
  | { readonly kind: "partner_changed"; readonly partner: MonsterAnimationIdentity | undefined }
  | { readonly kind: "tick" }
  | { readonly kind: "activity" }
  | { readonly kind: "viewport_resized"; readonly width: number }

export type MonsterAnimationResult =
  | { readonly kind: "blank" }
  | { readonly kind: "frame"; readonly frame: MonsterFrame }
  | { readonly kind: "unavailable"; readonly sprite: string }

export type MonsterFacing = WalkingFacing

type PositionedOutput = {
  readonly offset: number
  readonly facing: MonsterFacing
}

export type MonsterAnimationOutput =
  | ({ readonly kind: "blank"; readonly result: { readonly kind: "blank" } } & PositionedOutput)
  | ({
      readonly kind: "unavailable"
      readonly result: { readonly kind: "unavailable"; readonly sprite: string }
    } & PositionedOutput)
  | ({
      readonly kind: "digitama"
      readonly result: { readonly kind: "frame"; readonly frame: MonsterFrame }
    } & PositionedOutput)
  | ({
      readonly kind: "walking"
      readonly result: { readonly kind: "frame"; readonly frame: MonsterFrame }
    } & PositionedOutput)
  | ({
      readonly kind: "action" | "sleeping"
      readonly result: { readonly kind: "frame"; readonly frame: MonsterFrame }
    } & PositionedOutput)

type BlankState = { readonly kind: "blank" }
type UnavailableState = { readonly kind: "unavailable"; readonly identity: MonsterAnimationIdentity }
type DigitamaState = {
  readonly kind: "digitama"
  readonly identity: MonsterAnimationIdentity
  readonly frameName: WalkFrame
}
type WalkingState = {
  readonly kind: "walking"
  readonly identity: MonsterAnimationIdentity
  readonly policy: WalkingPolicyState
}
type ActionState = {
  readonly kind: "action"
  readonly identity: MonsterAnimationIdentity
  readonly boundary: ActionBoundaryState
  readonly clip: CosmeticActionClip
  readonly phase: 0 | 1
}
type SleepingState = {
  readonly kind: "sleeping"
  readonly identity: MonsterAnimationIdentity
  readonly boundary: ActionBoundaryState
  readonly clip: SleepClip
  readonly phase: 0 | 1
}

type MonsterAnimationState = BlankState | UnavailableState | DigitamaState | WalkingState | ActionState | SleepingState
const ORIGIN = { offset: 0, facing: "left" } as const
const SLEEP_AFTER_MS = 300_000

const assertNever = (value: never): never => {
  throw new Error(`Unexpected monster animation variant: ${JSON.stringify(value)}`)
}

const sameIdentity = (left: MonsterAnimationIdentity, right: MonsterAnimationIdentity): boolean =>
  left.sprite === right.sprite && left.isDigitama === right.isDigitama

export class MonsterAnimationController {
  readonly #catalog: MonsterFrameCatalog
  readonly #random: () => number
  readonly #nowMs: () => number
  #actions: readonly CosmeticActionClip[] = []
  #lastActivityMs: number | undefined
  #latestViewportWidth: number | undefined
  #state: MonsterAnimationState = { kind: "blank" }

  constructor(catalog: MonsterFrameCatalog, random: () => number = Math.random, nowMs: () => number = performance.now) {
    this.#catalog = catalog
    this.#random = random
    this.#nowMs = nowMs
  }

  dispatch(event: MonsterAnimationEvent): MonsterAnimationOutput {
    switch (event.kind) {
      case "partner_changed":
        this.#state = this.#changePartner(event.partner)
        break
      case "tick":
        this.#state = this.#tick()
        break
      case "activity":
        this.#state = this.#activity()
        break
      case "viewport_resized":
        this.#latestViewportWidth = event.width
        this.#state = this.#resize(event.width)
        break
      default:
        return assertNever(event)
    }
    return this.output()
  }

  output(): MonsterAnimationOutput {
    const state = this.#state
    switch (state.kind) {
      case "blank":
        return { kind: "blank", result: { kind: "blank" }, ...ORIGIN }
      case "unavailable":
        return { kind: "unavailable", result: { kind: "unavailable", sprite: state.identity.sprite }, ...ORIGIN }
      case "digitama":
        return { kind: "digitama", result: this.#frameResult(state.identity.sprite, state.frameName), ...ORIGIN }
      case "walking":
        return {
          kind: state.kind,
          result: this.#frameResult(state.identity.sprite, state.policy.frameName),
          offset: state.policy.offset,
          facing: state.policy.facing,
        }
      case "action":
        return {
          kind: state.kind,
          result: this.#frameResult(state.identity.sprite, state.clip[state.phase]),
          offset: state.boundary.offset,
          facing: state.boundary.facing,
        }
      case "sleeping":
        return {
          kind: state.kind,
          result: this.#frameResult(state.identity.sprite, state.clip[state.phase]),
          offset: state.boundary.offset,
          facing: state.boundary.facing,
        }
      default:
        return assertNever(state)
    }
  }

  setSprite(sprite: string | undefined): void {
    this.dispatch({
      kind: "partner_changed",
      partner: sprite === undefined ? undefined : { sprite, isDigitama: false },
    })
  }

  advance(): void {
    this.dispatch({ kind: "tick" })
  }

  get(): MonsterAnimationResult {
    return this.output().result
  }

  #changePartner(partner: MonsterAnimationIdentity | undefined): MonsterAnimationState {
    if (partner === undefined) return { kind: "blank" }
    const currentIdentity = this.#currentIdentity()
    if (currentIdentity !== undefined && sameIdentity(currentIdentity, partner)) return this.#state

    const frameName = this.#firstWalkFrame(partner.sprite)
    if (frameName === undefined) return { kind: "unavailable", identity: partner }
    if (partner.isDigitama) return { kind: "digitama", identity: partner, frameName }
    this.#actions = resolveCosmeticActions(partner.sprite, this.#catalog)
    this.#lastActivityMs = this.#nowMs()
    const policy = initialWalkingPolicy(frameName)
    return {
      kind: "walking",
      identity: partner,
      policy:
        this.#latestViewportWidth === undefined
          ? policy
          : resizeWalkingPolicy(policy, this.#latestViewportWidth, this.#random),
    }
  }

  #tick(): MonsterAnimationState {
    const state = this.#state
    switch (state.kind) {
      case "blank":
      case "unavailable":
        return state
      case "digitama":
        return { ...state, frameName: this.#nextWalkFrame(state.identity.sprite, state.frameName) }
      case "walking":
        if (this.#inactive()) return this.#sleep(state.identity, state.policy)
        return this.#tickWalking(state)
      case "action":
        if (this.#inactive()) return this.#sleep(state.identity, state.boundary)
        return state.phase === 0
          ? { ...state, phase: 1 }
          : { kind: "walking", identity: state.identity, policy: resumeWalkingPolicy(state.boundary, this.#random) }
      case "sleeping":
        return { ...state, phase: state.phase === 0 ? 1 : 0 }
      default:
        return assertNever(state)
    }
  }

  #tickWalking(state: WalkingState): MonsterAnimationState {
    const tick = tickWalkingPolicy(state.policy, state.identity.sprite, this.#catalog)
    switch (tick.kind) {
      case "walking":
        return { ...state, policy: tick.walking }
      case "action":
        return this.#startAction(state.identity, tick.action)
      default:
        return assertNever(tick)
    }
  }

  #resize(width: number): MonsterAnimationState {
    const state = this.#state
    switch (state.kind) {
      case "walking":
        return { ...state, policy: resizeWalkingPolicy(state.policy, width, this.#random) }
      case "action":
      case "sleeping":
        return { ...state, boundary: resizeActionBoundary(state.boundary, width) }
      default:
        return state
    }
  }

  #startAction(identity: MonsterAnimationIdentity, boundary: ActionBoundaryState): MonsterAnimationState {
    const clip = selectCosmeticAction(this.#actions, this.#random)
    return clip === undefined
      ? { kind: "walking", identity, policy: resumeWalkingPolicy(boundary, this.#random) }
      : { kind: "action", identity, boundary, clip, phase: 0 }
  }

  #inactive(): boolean {
    const baseline = this.#lastActivityMs
    return baseline !== undefined && this.#nowMs() - baseline >= SLEEP_AFTER_MS
  }

  #sleep(identity: MonsterAnimationIdentity, boundary: ActionBoundaryState): SleepingState {
    return {
      kind: "sleeping",
      identity,
      boundary,
      clip: resolveSleepClip(identity.sprite, boundary.frameName, this.#catalog),
      phase: 0,
    }
  }

  #activity(): MonsterAnimationState {
    const state = this.#state
    if (state.kind !== "walking" && state.kind !== "action" && state.kind !== "sleeping") return state
    this.#lastActivityMs = this.#nowMs()
    if (state.kind !== "sleeping") return state
    const frameName = this.#firstWalkFrame(state.identity.sprite)
    if (frameName === undefined) return state
    return {
      kind: "walking",
      identity: state.identity,
      policy: restartWalkingPolicy(state.boundary, frameName, this.#random),
    }
  }

  #currentIdentity(): MonsterAnimationIdentity | undefined {
    const state = this.#state
    switch (state.kind) {
      case "blank":
        return undefined
      case "unavailable":
      case "digitama":
      case "walking":
        return state.identity
      case "action":
      case "sleeping":
        return state.identity
      default:
        return assertNever(state)
    }
  }

  #firstWalkFrame(sprite: string): WalkFrame | undefined {
    if (this.#catalog.get(sprite, "walk_1") !== undefined) return "walk_1"
    if (this.#catalog.get(sprite, "walk_2") !== undefined) return "walk_2"
    return undefined
  }

  #nextWalkFrame(sprite: string, current: WalkFrame): WalkFrame {
    const alternate = current === "walk_1" ? "walk_2" : "walk_1"
    return this.#catalog.get(sprite, alternate) === undefined ? current : alternate
  }

  #frameResult(sprite: string, frameName: MonsterFrameName): { readonly kind: "frame"; readonly frame: MonsterFrame } {
    const frame = this.#catalog.get(sprite, frameName)
    if (frame === undefined) throw new Error(`Animation state references unavailable frame: ${sprite}/${frameName}`)
    return { kind: "frame", frame }
  }
}
