import { join } from "node:path"
import * as vscode from "vscode"

import { freezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/freeze-digital-pet.ts"
import { setDigitalPetCheatNode } from "@jcendal/digital-pet-core/application/use-cases/set-digital-pet-cheat-node.ts"
import { spawnPartner } from "@jcendal/digital-pet-core/application/use-cases/spawn-partner.ts"
import { unfreezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/unfreeze-digital-pet.ts"

import { installDigitalPetHooks, uninstallDigitalPetHooks } from "../adapters/cursor/install-hooks.ts"
import { openDexPanel } from "../webview/panels/dex-panel.ts"
import { openHistoryPanel } from "../webview/panels/history-panel.ts"
import type { DigitalPetContainer } from "./container.ts"

export const registerCommands = (context: vscode.ExtensionContext, container: DigitalPetContainer): void => {
  const { repository, databaseOptions, refreshSidebar } = container

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("digital-pet")) return
      vscode.window.showInformationMessage(
        "Digital Pet settings changed. Reload the window to apply database path changes.",
      )
    }),
    vscode.commands.registerCommand("cursorDigitalPet.spawn", async () => {
      spawnPartner(repository, new Date().toISOString())
      vscode.window.showInformationMessage("Digital Pet partner spawned.")
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorDigitalPet.freeze", async () => {
      const result = freezeDigitalPet(repository)
      vscode.window.showInformationMessage(
        result.kind === "frozen" ? "Digital Pet frozen." : "Digital Pet already frozen.",
      )
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorDigitalPet.unfreeze", async () => {
      const result = unfreezeDigitalPet(repository)
      vscode.window.showInformationMessage(
        result.kind === "unfrozen" ? "Digital Pet unfrozen." : "Digital Pet already active.",
      )
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorDigitalPet.set", async () => {
      const nodeId = await vscode.window.showInputBox({ prompt: "Digimon node ID (e.g. 0-001)" })
      if (nodeId === undefined || nodeId.length === 0) return
      const result = setDigitalPetCheatNode(repository, nodeId)
      vscode.window.showInformationMessage(`Set result: ${result.kind}`)
      refreshSidebar()
    }),
    vscode.commands.registerCommand("cursorDigitalPet.dex", () => openDexPanel(context, databaseOptions())),
    vscode.commands.registerCommand("cursorDigitalPet.history", () => openHistoryPanel(context, databaseOptions())),
    vscode.commands.registerCommand("cursorDigitalPet.installHooks", async () => {
      const bridgePath = join(context.extensionPath, "hook-bridge.js")
      installDigitalPetHooks(bridgePath)
      await context.globalState.update("digital-pet.hooksInstalled", true)
    }),
    vscode.commands.registerCommand("cursorDigitalPet.uninstallHooks", () => {
      uninstallDigitalPetHooks()
      void context.globalState.update("digital-pet.hooksInstalled", false)
    }),
  )
}
