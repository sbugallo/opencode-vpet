import * as vscode from "vscode"

import type { SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import type { EvolutionBattleRepository } from "@sbugallo/vpet-core/application/use-cases/resolve-evolution-battle.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { createAnimationSink, type AnimationSink } from "../../adapters/vscode/animation-sink.ts"
import { createVsCodeNotificationPort, type NotificationPort } from "../../adapters/vscode/notification-port.ts"
import { createIntervalScheduler, type IntervalScheduler } from "../../adapters/vscode/scheduler.ts"
import { createWebviewMessenger } from "../../adapters/vscode/webview-messenger.ts"
import { createSidebarAnimationHost, type SidebarAnimationHost } from "./sidebar-animation-host.ts"
import { createSidebarOrchestrator, type SidebarOrchestrator } from "./sidebar-orchestrator.ts"
import { buildSidebarWebviewHtml } from "./sidebar-render.ts"
import { parseWebviewInboundMessage } from "./webview-messages.ts"

export type VpetSidebarProviderOptions = {
  readonly notification?: NotificationPort
  readonly scheduler?: IntervalScheduler
  readonly random?: () => number
  readonly nowMs?: () => number
}

const createDeferredAnimationSink = (): { readonly sink: AnimationSink; setSink(next: AnimationSink): void } => {
  let current: AnimationSink = {
    postArtwork: async () => {},
    postModel: async () => {},
  }
  return {
    sink: {
      postArtwork: async (artwork) => current.postArtwork(artwork),
      postModel: async (payload) => current.postModel(payload),
    },
    setSink(next: AnimationSink): void {
      current = next
    },
  }
}

export class VpetSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorVpet.sidebar"

  private view?: vscode.WebviewView
  private readonly notification: NotificationPort
  private readonly scheduler: IntervalScheduler
  private readonly animationHost: SidebarAnimationHost
  private readonly orchestrator: SidebarOrchestrator
  private readonly deferredSink: ReturnType<typeof createDeferredAnimationSink>

  constructor(
    private readonly extensionUri: vscode.Uri,
    snapshotReader: SidebarSnapshotReader,
    battleRepository: EvolutionBattleRepository,
    options: VpetSidebarProviderOptions = {},
  ) {
    this.notification = options.notification ?? createVsCodeNotificationPort()
    this.scheduler = options.scheduler ?? createIntervalScheduler()
    const random = options.random ?? Math.random
    const nowMs = options.nowMs ?? (() => performance.now())
    this.deferredSink = createDeferredAnimationSink()

    this.animationHost = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink: this.deferredSink.sink,
      scheduler: this.scheduler,
      random,
      nowMs,
      isVisible: () => this.view?.visible === true,
    })

    this.orchestrator = createSidebarOrchestrator({
      snapshotReader,
      battleRepository,
      animationHost: this.animationHost,
      notification: this.notification,
      random,
      onPresentationEnd: () => {
        if (this.view?.visible === true) this.animationHost.start()
      },
    })
    this.orchestrator.setSink(this.deferredSink.sink)
  }

  isPresentationInProgress(): boolean {
    return this.orchestrator.isPresentationInProgress()
  }

  queueEvolutionReveal(evolution: Parameters<SidebarOrchestrator["queueEvolutionReveal"]>[0]): void {
    this.orchestrator.queueEvolutionReveal(evolution)
  }

  async refresh(): Promise<void> {
    await this.orchestrator.refresh()
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    const sink = createAnimationSink(createWebviewMessenger(webviewView.webview))
    this.deferredSink.setSink(sink)
    this.orchestrator.setSink(sink)

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }

    webviewView.webview.html = buildSidebarWebviewHtml(String(Date.now()))

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      const inbound = parseWebviewInboundMessage(message)
      if (inbound === null) return
      if (inbound.type === "open-url") {
        void vscode.env.openExternal(vscode.Uri.parse(inbound.url))
        return
      }
      this.animationHost.setArtworkWidth(inbound.width)
      void this.animationHost.postCurrentFrame()
    })

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.animationHost.start()
        void this.refresh()
      } else {
        this.animationHost.stop()
      }
    })

    const cachedPayload = this.orchestrator.getCachedPayload()
    if (cachedPayload !== undefined) {
      void sink.postModel(cachedPayload)
    }

    if (webviewView.visible) {
      this.animationHost.start()
      void this.refresh()
    }
  }

  dispose(): void {
    this.animationHost.stop()
    delete this.view
  }
}
