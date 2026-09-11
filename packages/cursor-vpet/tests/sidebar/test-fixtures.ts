import type { SidebarSnapshot } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import type { EvolutionBattleRepository } from "@sbugallo/vpet-core/application/use-cases/resolve-evolution-battle.ts"
import type { AnimationSink } from "../../src/adapters/vscode/animation-sink.ts"
import type { NotificationPort } from "../../src/adapters/vscode/notification-port.ts"
import type { IntervalScheduler } from "../../src/adapters/vscode/scheduler.ts"
import type { SidebarWebviewPayload } from "../../src/webview/sidebar/webview-messages.ts"
import type { SidebarAnimationHost } from "../../src/webview/sidebar/sidebar-animation-host.ts"
export const nullSidebarSnapshot = (): null => null

export const partnerSidebarSnapshot = (): SidebarSnapshot => ({
  currentNodeId: "3-001",
  gauge: 10,
  isTerminal: false,
  frozen: false,
  isSetOverride: false,
  trainerTotalTokens: 100,
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
})

export const battleSidebarSnapshot = (): SidebarSnapshot => ({
  currentNodeId: "3-001",
  gauge: 50,
  isTerminal: false,
  frozen: false,
  isSetOverride: false,
  trainerTotalTokens: 500,
  pendingEvolutionTargetId: "4-017",
  battleOpponentNodeId: "3-051",
})

export const createCaptureSink = (): {
  sink: AnimationSink
  models: SidebarWebviewPayload[]
  artworks: string[]
} => {
  const models: SidebarWebviewPayload[] = []
  const artworks: string[] = []
  return {
    models,
    artworks,
    sink: {
      postModel: async (payload) => {
        models.push(payload)
      },
      postArtwork: async (artwork) => {
        artworks.push(artwork)
      },
    },
  }
}

export const createCaptureNotification = (): NotificationPort & { messages: string[] } => {
  const messages: string[] = []
  return {
    messages,
    showInformation(message: string): void {
      messages.push(message)
    },
  }
}

export const createSpyAnimationHost = (): SidebarAnimationHost & {
  syncCalls: number
  blocked: boolean
  artworkWidth: number
  started: boolean
} => {
  const state = {
    syncCalls: 0,
    blocked: false,
    artworkWidth: 32,
    started: false,
  }
  return {
    setArtworkWidth(width: number): void {
      state.artworkWidth = width
    },
    syncPartner(): void {
      state.syncCalls += 1
    },
    start(): void {
      state.started = true
    },
    stop(): void {
      state.started = false
    },
    clearArtwork(): void {},
    async postCurrentFrame(): Promise<void> {},
    isPresentationBlocked(): boolean {
      return state.blocked
    },
    setPresentationBlocked(blocked: boolean): void {
      state.blocked = blocked
    },
    getArtworkWidth(): number {
      return state.artworkWidth
    },
    get syncCalls(): number {
      return state.syncCalls
    },
    get blocked(): boolean {
      return state.blocked
    },
    get artworkWidth(): number {
      return state.artworkWidth
    },
    get started(): boolean {
      return state.started
    },
  }
}

export const createBattleRepository = (outcome: "won" | "lost" = "won"): EvolutionBattleRepository => ({
  getActivePartner: () => ({
    partnerId: "partner-1",
    generation: 1,
    currentNodeId: "3-001",
    gauge: 50,
    isTerminal: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    pendingEvolutionTargetId: "4-017",
    battleOpponentNodeId: "3-051",
  }),
  resolveEvolutionBattle: () =>
    outcome === "won" ? { kind: "won", evolution: { fromNodeId: "3-001", toNodeId: "4-017" } } : { kind: "lost" },
})

export const createManualScheduler = (): IntervalScheduler & {
  tick: () => void
  readonly state: { stopped: boolean }
} => {
  let callback: (() => void) | undefined
  const state = { stopped: false }
  return {
    state,
    start(next: () => void): () => void {
      callback = next
      state.stopped = false
      return () => {
        callback = undefined
        state.stopped = true
      }
    },
    tick(): void {
      callback?.()
    },
  }
}

export const sequenceRandom = (values: readonly number[]): (() => number) => {
  let index = 0
  return () => values[index++] ?? values[values.length - 1] ?? 0.5
}
