import type { UsageEvolutionTransition } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import type { EvolutionBattleRepository } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { runEvolutionBattleSession } from "@jcendal/digital-pet-animation/sessions/evolution-battle-session.ts"
import { runEvolutionRevealSession } from "@jcendal/digital-pet-animation/sessions/evolution-reveal-session.ts"

import type { AnimationSink } from "../../adapters/vscode/animation-sink.ts"
import type { NotificationPort } from "../../adapters/vscode/notification-port.ts"
import { createAsyncRefreshQueue } from "../../shared/async-refresh-queue.ts"
import type { SidebarAnimationHost } from "./sidebar-animation-host.ts"
import { buildSidebarPresentation } from "./sidebar-presenter.ts"
import type { SidebarWebviewPayload } from "./webview-messages.ts"

export type SidebarOrchestrator = {
  refresh(): Promise<void>
  queueEvolutionReveal(evolution: UsageEvolutionTransition): void
  isPresentationInProgress(): boolean
  getCachedPayload(): SidebarWebviewPayload | undefined
  setSink(sink: AnimationSink): void
}

export type CreateSidebarOrchestratorOptions = {
  readonly snapshotReader: SidebarSnapshotReader
  readonly battleRepository: EvolutionBattleRepository
  readonly animationHost: SidebarAnimationHost
  readonly notification: NotificationPort
  readonly random?: () => number
  readonly onPresentationEnd?: () => void
}

export const createSidebarOrchestrator = ({
  snapshotReader,
  battleRepository,
  animationHost,
  notification,
  random = Math.random,
  onPresentationEnd,
}: CreateSidebarOrchestratorOptions): SidebarOrchestrator => {
  const refreshQueue = createAsyncRefreshQueue()
  let sink: AnimationSink | undefined
  let cachedPayload: SidebarWebviewPayload | undefined
  let pendingEvolutionReveal: UsageEvolutionTransition | undefined
  let presentationInProgress = false

  const publishSidebarModel = async (): Promise<void> => {
    if (sink === undefined) return
    const presentation = buildSidebarPresentation(snapshotReader.getSidebarSnapshot())
    cachedPayload = presentation.payload
    await sink.postModel(presentation.payload)
    if (presentationInProgress) return
    animationHost.syncPartner(presentation.partner)
    await animationHost.postCurrentFrame()
  }

  const resolvePendingBattleIfNeeded = async (): Promise<void> => {
    if (presentationInProgress) return
    const snapshot = snapshotReader.getSidebarSnapshot()
    if (snapshot === null) return
    if (snapshot.pendingEvolutionTargetId === null || snapshot.battleOpponentNodeId === null) return

    presentationInProgress = true
    animationHost.setPresentationBlocked(true)
    animationHost.stop()
    animationHost.clearArtwork()

    try {
      await runEvolutionBattleSession(snapshot, animationHost.getArtworkWidth(), {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: battleRepository,
        random,
        onArtwork: async (artwork) => {
          if (sink !== undefined) await sink.postArtwork(artwork)
        },
        onResolved: async (result) => {
          if (result.kind === "won") {
            pendingEvolutionReveal = undefined
            notification.showInformation("Victory! Your partner evolved!")
          } else if (result.kind === "lost") {
            notification.showInformation("Defeat! You lost all tokens for this stage.")
          }
        },
      })
    } finally {
      presentationInProgress = false
      animationHost.setPresentationBlocked(false)
      onPresentationEnd?.()
    }
  }

  const playPendingEvolutionReveal = async (): Promise<void> => {
    const evolution = pendingEvolutionReveal
    if (evolution === undefined || presentationInProgress) return

    pendingEvolutionReveal = undefined
    presentationInProgress = true
    animationHost.setPresentationBlocked(true)
    animationHost.stop()
    animationHost.clearArtwork()

    try {
      const revealed = await runEvolutionRevealSession(evolution, animationHost.getArtworkWidth(), {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        onArtwork: async (artwork) => {
          if (sink !== undefined) await sink.postArtwork(artwork)
        },
      })
      if (revealed) {
        notification.showInformation("Your partner evolved!")
      }
    } finally {
      presentationInProgress = false
      animationHost.setPresentationBlocked(false)
      onPresentationEnd?.()
    }
  }

  return {
    async refresh(): Promise<void> {
      await refreshQueue.run(async () => {
        await resolvePendingBattleIfNeeded()
        await playPendingEvolutionReveal()
        await publishSidebarModel()
      })
    },
    queueEvolutionReveal(evolution: UsageEvolutionTransition): void {
      pendingEvolutionReveal = evolution
    },
    isPresentationInProgress(): boolean {
      return presentationInProgress
    },
    getCachedPayload(): SidebarWebviewPayload | undefined {
      return cachedPayload
    },
    setSink(nextSink: AnimationSink): void {
      sink = nextSink
    },
  }
}
