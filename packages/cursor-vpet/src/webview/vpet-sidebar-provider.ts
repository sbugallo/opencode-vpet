import * as vscode from "vscode"

import { DEFAULT_VPET_SETTINGS } from "@sbugallo/vpet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { getSidebarCardInputs } from "@sbugallo/vpet-core/application/use-cases/get-sidebar-card-inputs.ts"
import { buildSidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"
import type { HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"
import { readSidebarSnapshot } from "../adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { buildSidebarWebviewHtml, toSidebarWebviewPayload } from "./sidebar-render.ts"

export type VpetSidebarProviderOptions = HostPathOptions & {
  readonly databasePath?: string
}

export class VpetSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorVpet.sidebar"

  private view?: vscode.WebviewView

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly options: VpetSidebarProviderOptions = {},
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }
    webviewView.webview.html = buildSidebarWebviewHtml(String(Date.now()))
    webviewView.webview.onDidReceiveMessage((message: { readonly type?: string; readonly url?: string }) => {
      if (message.type === "open-url" && typeof message.url === "string" && message.url.length > 0) {
        void vscode.env.openExternal(vscode.Uri.parse(message.url))
      }
    })
    void this.refresh()
  }

  async refresh(): Promise<void> {
    if (this.view === undefined) return
    const snapshot = await readSidebarSnapshot(this.options)
    const reader = { getSidebarSnapshot: () => snapshot }
    const inputs = getSidebarCardInputs(reader, DIGIMON_CATALOG)
    const model = buildSidebarCardModel(inputs, DEFAULT_VPET_SETTINGS)
    await this.view.webview.postMessage(toSidebarWebviewPayload(model))
  }
}
