import type { MonsterFrameCatalog } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import {
  MonsterAnimationController,
  type MonsterAnimationIdentity,
  type MonsterAnimationOutput,
} from "@sbugallo/vpet-animation/idle/monster-animation.ts"
import { renderPositionedArtwork } from "@sbugallo/vpet-animation/render/positioned-artwork.ts"

import type { AnimationSink } from "../../adapters/vscode/animation-sink.ts"
import type { IntervalScheduler } from "../../adapters/vscode/scheduler.ts"
import { SIDEBAR_VISUAL_INTERVAL_MS } from "../../shared/constants/presentation-timing.ts"
import { DEFAULT_ARTWORK_WIDTH, MIN_ARTWORK_WIDTH } from "../../shared/constants/sidebar-ui.ts"

export type SidebarAnimationHost = {
  setArtworkWidth(width: number): void
  syncPartner(partner: MonsterAnimationIdentity | undefined): void
  start(): void
  stop(): void
  clearArtwork(): void
  postCurrentFrame(animation?: MonsterAnimationOutput): Promise<void>
  isPresentationBlocked(): boolean
  setPresentationBlocked(blocked: boolean): void
  getArtworkWidth(): number
}

export type CreateSidebarAnimationHostOptions = {
  readonly frameCatalog: MonsterFrameCatalog
  readonly sink: AnimationSink
  readonly scheduler: IntervalScheduler
  readonly random?: () => number
  readonly nowMs?: () => number
  readonly isVisible?: () => boolean
}

export const createSidebarAnimationHost = ({
  frameCatalog,
  sink,
  scheduler,
  random = Math.random,
  nowMs = () => performance.now(),
  isVisible = () => true,
}: CreateSidebarAnimationHostOptions): SidebarAnimationHost => {
  const animation = new MonsterAnimationController(frameCatalog, random, nowMs)
  let artworkWidth = DEFAULT_ARTWORK_WIDTH
  let cachedArtwork = ""
  let presentationBlocked = false
  let stopInterval: (() => void) | undefined

  const postCurrentFrame = async (nextAnimation?: MonsterAnimationOutput): Promise<void> => {
    if (presentationBlocked) return
    const output = nextAnimation ?? animation.output()
    const artwork = renderPositionedArtwork(output, artworkWidth)
    if (artwork === cachedArtwork) return
    cachedArtwork = artwork
    await sink.postArtwork(artwork)
  }

  return {
    setArtworkWidth(width: number): void {
      artworkWidth = Math.max(MIN_ARTWORK_WIDTH, Math.floor(width))
      animation.dispatch({ kind: "viewport_resized", width: artworkWidth })
    },
    syncPartner(partner: MonsterAnimationIdentity | undefined): void {
      animation.dispatch({ kind: "partner_changed", partner })
    },
    start(): void {
      if (stopInterval !== undefined) return
      stopInterval = scheduler.start(() => {
        if (!isVisible() || presentationBlocked) return
        const nextAnimation = animation.dispatch({ kind: "tick" })
        void postCurrentFrame(nextAnimation)
      }, SIDEBAR_VISUAL_INTERVAL_MS)
    },
    stop(): void {
      stopInterval?.()
      stopInterval = undefined
    },
    clearArtwork(): void {
      cachedArtwork = ""
    },
    postCurrentFrame,
    isPresentationBlocked(): boolean {
      return presentationBlocked
    },
    setPresentationBlocked(blocked: boolean): void {
      presentationBlocked = blocked
    },
    getArtworkWidth(): number {
      return artworkWidth
    },
  }
}
