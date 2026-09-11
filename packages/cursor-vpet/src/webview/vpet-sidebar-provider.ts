import * as vscode from "vscode"

import { DEFAULT_VPET_SETTINGS } from "@sbugallo/vpet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { getSidebarCardInputs } from "@sbugallo/vpet-core/application/use-cases/get-sidebar-card-inputs.ts"
import type { SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import { buildSidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"
import { renderPositionedArtwork } from "./animated-artwork.ts"
import { MonsterAnimationController, type MonsterAnimationOutput } from "./monster-animation.ts"
import {
  buildSidebarWebviewHtml,
  DEFAULT_ARTWORK_WIDTH,
  MIN_ARTWORK_WIDTH,
  toSidebarWebviewPayload,
  type SidebarWebviewPayload,
} from "./sidebar-render.ts"

const VISUAL_INTERVAL_MS = 500

export class VpetSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorVpet.sidebar"

  private view?: vscode.WebviewView
  private cachedPayload?: SidebarWebviewPayload
  private cachedArtwork = ""
  private artworkWidth = DEFAULT_ARTWORK_WIDTH
  private visualInterval?: ReturnType<typeof setInterval>
  private readonly animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG, Math.random, () =>
    performance.now(),
  )

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly snapshotReader: SidebarSnapshotReader,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }

    webviewView.webview.html = buildSidebarWebviewHtml(String(Date.now()))

    webviewView.webview.onDidReceiveMessage(
      (message: { readonly type?: string; readonly url?: string; readonly width?: number }) => {
        if (message.type === "open-url" && typeof message.url === "string" && message.url.length > 0) {
          void vscode.env.openExternal(vscode.Uri.parse(message.url))
          return
        }
        if (message.type === "artwork-width" && typeof message.width === "number" && Number.isFinite(message.width)) {
          this.artworkWidth = Math.max(MIN_ARTWORK_WIDTH, Math.floor(message.width))
          this.syncAnimationViewport()
          void this.postAnimationFrame()
        }
      },
    )

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.startVisualInterval()
        void this.refresh()
      } else {
        this.stopVisualInterval()
      }
    })

    if (this.cachedPayload !== undefined) {
      void this.view.webview.postMessage(this.cachedPayload)
    }
    if (this.cachedArtwork.length > 0) {
      void this.view.webview.postMessage({ type: "animation-frame", artwork: this.cachedArtwork })
    }

    if (webviewView.visible) {
      this.startVisualInterval()
      void this.refresh()
    }
  }

  async refresh(): Promise<void> {
    if (this.view === undefined) return

    const snapshot = this.snapshotReader.getSidebarSnapshot()
    const reader = { getSidebarSnapshot: () => snapshot }
    const inputs = getSidebarCardInputs(reader, DIGIMON_CATALOG)
    const model = buildSidebarCardModel(inputs, DEFAULT_VPET_SETTINGS)
    const payload = toSidebarWebviewPayload(model)
    this.cachedPayload = payload
    await this.view.webview.postMessage(payload)
    this.syncAnimationPartner(model)
    await this.postAnimationFrame()
  }

  dispose(): void {
    this.stopVisualInterval()
    delete this.view
  }

  private syncAnimationPartner(model: ReturnType<typeof buildSidebarCardModel>): void {
    this.animation.dispatch({
      kind: "partner_changed",
      partner: model.kind === "partner" ? { sprite: model.sprite, isDigitama: model.stageNumber === 0 } : undefined,
    })
  }

  private syncAnimationViewport(): void {
    this.animation.dispatch({ kind: "viewport_resized", width: this.artworkWidth })
  }

  private startVisualInterval(): void {
    if (this.visualInterval !== undefined) return
    this.visualInterval = setInterval(() => {
      if (this.view === undefined || !this.view.visible) return
      const nextAnimation = this.animation.dispatch({ kind: "tick" })
      void this.postAnimationFrame(nextAnimation)
    }, VISUAL_INTERVAL_MS)
  }

  private stopVisualInterval(): void {
    if (this.visualInterval === undefined) return
    clearInterval(this.visualInterval)
    delete this.visualInterval
  }

  private async postAnimationFrame(animation?: MonsterAnimationOutput): Promise<void> {
    if (this.view === undefined) return
    const output = animation ?? this.animation.output()
    const artwork = renderPositionedArtwork(output, this.artworkWidth)
    if (artwork === this.cachedArtwork) return
    this.cachedArtwork = artwork
    await this.view.webview.postMessage({ type: "animation-frame", artwork })
  }
}
