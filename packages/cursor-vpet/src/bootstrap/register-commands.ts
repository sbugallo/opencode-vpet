import { join } from "node:path"
import * as vscode from "vscode"

import { freezeVpet } from "@sbugallo/vpet-core/application/use-cases/freeze-vpet.ts"
import { setVpetCheatNode } from "@sbugallo/vpet-core/application/use-cases/set-vpet-cheat-node.ts"
import { spawnPartner } from "@sbugallo/vpet-core/application/use-cases/spawn-partner.ts"
import { unfreezeVpet } from "@sbugallo/vpet-core/application/use-cases/unfreeze-vpet.ts"

import { installVpetHooks, uninstallVpetHooks } from "../adapters/cursor/install-hooks.ts"
import { openDexPanel } from "../webview/panels/dex-panel.ts"
import { openHistoryPanel } from "../webview/panels/history-panel.ts"
import type { VpetContainer } from "./container.ts"

export const registerCommands = (context: vscode.ExtensionContext, container: VpetContainer): void => {
  const { repository, databaseOptions, refreshSidebar } = container

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
}
