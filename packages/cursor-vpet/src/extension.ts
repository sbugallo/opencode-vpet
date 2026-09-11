import { existsSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"

import { spawnPartner } from "@sbugallo/vpet-core/application/use-cases/spawn-partner.ts"
import { freezeVpet } from "@sbugallo/vpet-core/application/use-cases/freeze-vpet.ts"
import { unfreezeVpet } from "@sbugallo/vpet-core/application/use-cases/unfreeze-vpet.ts"
import { setVpetCheatNode } from "@sbugallo/vpet-core/application/use-cases/set-vpet-cheat-node.ts"
import { createCursorUsageEventSource } from "./adapters/cursor/cursor-usage-event-source.ts"
import { installVpetHooks, uninstallVpetHooks } from "./adapters/cursor/install-hooks.ts"
import { resolveStateVscdbPath } from "./adapters/cursor/paths.ts"
import { configureSqlJsWasmPath } from "./adapters/sqlite/sqljs-config.ts"
import { createDatabaseChangeWatcher } from "./adapters/sqlite/database-change-watcher.ts"
import { createSqliteVpetRepository } from "./adapters/sqlite/sqlite-vpet-write-store.ts"
import { getVpetExtensionSettings, toDatabaseOptions } from "./config/extension-settings.ts"
import { openDexPanel } from "./webview/dex-panel.ts"
import { openHistoryPanel } from "./webview/history-panel.ts"
import { VpetSidebarProvider } from "./webview/vpet-sidebar-provider.ts"

let sidebarProvider: VpetSidebarProvider | undefined

const isCursorRuntime = (): boolean => existsSync(resolveStateVscdbPath())

const ensureHooksInstalled = async (context: vscode.ExtensionContext): Promise<void> => {
  const key = "vpet.hooksInstalled"
  if (context.globalState.get<boolean>(key) === true) return

  const choice = await vscode.window.showInformationMessage(
    "Cursor VPet needs to register hooks in ~/.cursor/hooks.json to track Agent usage.",
    "Install hooks",
    "Not now",
  )
  if (choice !== "Install hooks") return

  const bridgePath = join(context.extensionPath, "hook-bridge.js")
  const result = installVpetHooks(bridgePath)
  await context.globalState.update(key, true)
  vscode.window.showInformationMessage(`VPet hooks installed at ${result.hooksPath}`)
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  configureSqlJsWasmPath(join(context.extensionPath, "dist", "sql-wasm.wasm"))

  if (!isCursorRuntime()) {
    vscode.window.showWarningMessage("Cursor VPet: token tracking requires Cursor (state.vscdb not found).")
  }

  const readSettings = () => getVpetExtensionSettings()
  const databaseOptions = () => toDatabaseOptions(readSettings())

  const repository = await createSqliteVpetRepository(databaseOptions())
  context.subscriptions.push({ dispose: () => repository.close() })

  sidebarProvider = new VpetSidebarProvider(context.extensionUri, repository, repository)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VpetSidebarProvider.viewType, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    { dispose: () => sidebarProvider?.dispose() },
  )

  const refreshSidebar = (): void => {
    void sidebarProvider?.refresh()
  }

  const usageSource = createCursorUsageEventSource(repository, (result) => {
    if (result.kind === "applied" && result.evolution !== undefined) {
      sidebarProvider?.queueEvolutionReveal(result.evolution)
    }
    refreshSidebar()
  }, {
    settleDelayMs: readSettings().settleDelayMs,
  })
  context.subscriptions.push(usageSource)

  const databaseWatcher = createDatabaseChangeWatcher({
    ...databaseOptions(),
    onChange: () => {
      repository.reloadFromDisk()
      if (sidebarProvider?.isPresentationInProgress() !== true) {
        refreshSidebar()
      }
    },
  })
  context.subscriptions.push({ dispose: () => databaseWatcher.dispose() })

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("vpet")) return
      vscode.window.showInformationMessage("VPet settings changed. Reload the window to apply database path changes.")
    }),
    vscode.commands.registerCommand("cursorVpet.spawn", async () => {
      spawnPartner(repository, new Date().toISOString())
      vscode.window.showInformationMessage("VPet partner spawned.")
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorVpet.freeze", async () => {
      const result = freezeVpet(repository)
      vscode.window.showInformationMessage(result.kind === "frozen" ? "VPet frozen." : "VPet already frozen.")
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorVpet.unfreeze", async () => {
      const result = unfreezeVpet(repository)
      vscode.window.showInformationMessage(result.kind === "unfrozen" ? "VPet unfrozen." : "VPet already active.")
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorVpet.set", async () => {
      const nodeId = await vscode.window.showInputBox({ prompt: "Digimon node ID (e.g. 0-001)" })
      if (nodeId === undefined || nodeId.length === 0) return
      const result = setVpetCheatNode(repository, nodeId)
      vscode.window.showInformationMessage(`Set result: ${result.kind}`)
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorVpet.dex", () => openDexPanel(context, databaseOptions())),
    vscode.commands.registerCommand("cursorVpet.history", () => openHistoryPanel(context, databaseOptions())),
    vscode.commands.registerCommand("cursorVpet.installHooks", async () => {
      const bridgePath = join(context.extensionPath, "hook-bridge.js")
      installVpetHooks(bridgePath)
      await context.globalState.update("vpet.hooksInstalled", true)
    }),
    vscode.commands.registerCommand("cursorVpet.uninstallHooks", () => {
      uninstallVpetHooks()
      void context.globalState.update("vpet.hooksInstalled", false)
    }),
  )

  const poll = setInterval(refreshSidebar, 30_000)
  context.subscriptions.push({ dispose: () => clearInterval(poll) })

  await ensureHooksInstalled(context)
  refreshSidebar()
}

export function deactivate(): void {
  sidebarProvider = undefined
}
