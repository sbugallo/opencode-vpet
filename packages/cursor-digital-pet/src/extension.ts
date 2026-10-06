import { existsSync } from "node:fs"
import * as vscode from "vscode"

import { resolveStateVscdbPath } from "./adapters/cursor/paths.ts"
import { createUsagePipeline } from "./application/usage-pipeline.ts"
import { isDevToolsEnabled, syncDevToolsContext } from "./config/extension-settings.ts"
import { createDigitalPetContainer } from "./bootstrap/container.ts"
import { ensureHooksInstalled } from "./bootstrap/ensure-hooks.ts"
import { registerCommands } from "./bootstrap/register-commands.ts"
import { registerSidebar } from "./bootstrap/register-sidebar.ts"

const isCursorRuntime = (): boolean => existsSync(resolveStateVscdbPath())

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!isCursorRuntime()) {
    vscode.window.showWarningMessage("Cursor Digital Pet: token tracking requires Cursor (state.vscdb not found).")
  }

  const container = await createDigitalPetContainer(context)
  registerSidebar(context, container)
  registerCommands(context, container)

  const usageSource = createUsagePipeline(
    container.repository,
    (result) => {
      if (result.kind === "applied") {
        container.sidebarProvider.playFeedAnimation()
        if (result.evolution !== undefined) {
          container.sidebarProvider.queueEvolutionReveal(result.evolution)
        }
      }
      container.refreshSidebar()
    },
    { settleDelayMs: container.readSettings().settleDelayMs },
  )
  context.subscriptions.push(usageSource)

  const poll = setInterval(container.refreshSidebar, 30_000)
  context.subscriptions.push({ dispose: () => clearInterval(poll) })

  await ensureHooksInstalled(context)
  container.refreshSidebar()

  await syncDevToolsContext(context.extensionMode)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("digital-pet.devTools")) return
      void syncDevToolsContext(context.extensionMode)
    }),
  )

  if (isDevToolsEnabled(context.extensionMode)) {
    const { registerDevCommands } = await import("./dev/register-commands.ts")
    registerDevCommands(context, container)
  }
}

export function deactivate(): void {}
