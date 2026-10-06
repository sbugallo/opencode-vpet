import * as vscode from "vscode"

import type { DigitalPetContainer } from "../bootstrap/container.ts"
import { CURSOR_DEV_ACTIONS, type CursorDevActionId, DEV_SHOW_MENU_COMMAND } from "./catalog.ts"
import { DEV_EVOLUTION } from "./fixtures.ts"
import { setupBattlePending } from "./setup-scenario.ts"

const warnBusy = (): void => {
  void vscode.window.showWarningMessage("Digital Pet dev: presentation already in progress.")
}

export const registerDevCommands = (context: vscode.ExtensionContext, container: DigitalPetContainer): void => {
  const { sidebarProvider, repository } = container

  const handlers: Record<CursorDevActionId, () => void | Promise<void>> = {
    feed: () => {
      if (sidebarProvider.isPresentationInProgress()) {
        warnBusy()
        return
      }
      sidebarProvider.playFeedAnimation()
    },
    evolution_reveal: async () => {
      if (sidebarProvider.isPresentationInProgress()) {
        warnBusy()
        return
      }
      sidebarProvider.queueEvolutionReveal(DEV_EVOLUTION)
      await sidebarProvider.refresh()
    },
    evolution_battle: async () => {
      if (sidebarProvider.isPresentationInProgress()) {
        warnBusy()
        return
      }
      try {
        setupBattlePending(repository)
        await sidebarProvider.refresh()
      } catch (error) {
        void vscode.window.showErrorMessage(
          `Digital Pet dev: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(DEV_SHOW_MENU_COMMAND, async () => {
      const picked = await vscode.window.showQuickPick(
        CURSOR_DEV_ACTIONS.map((action) => ({ label: action.label, actionId: action.id })),
        { title: "Digital Pet Dev Tools" },
      )
      if (picked === undefined) return
      void handlers[picked.actionId]()
    }),
  )
}
