import { existsSync } from "node:fs"
import * as vscode from "vscode"

import { resolveStateVscdbPath } from "./adapters/cursor/paths.ts"
import { createUsagePipeline } from "./application/usage-pipeline.ts"
import { createVpetContainer } from "./bootstrap/container.ts"
import { ensureHooksInstalled } from "./bootstrap/ensure-hooks.ts"
import { registerCommands } from "./bootstrap/register-commands.ts"
import { registerSidebar } from "./bootstrap/register-sidebar.ts"

const isCursorRuntime = (): boolean => existsSync(resolveStateVscdbPath())

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!isCursorRuntime()) {
    vscode.window.showWarningMessage("Cursor VPet: token tracking requires Cursor (state.vscdb not found).")
  }

  const container = await createVpetContainer(context)
  registerSidebar(context, container)
  registerCommands(context, container)

  const usageSource = createUsagePipeline(
    container.repository,
    (result) => {
      if (result.kind === "applied" && result.evolution !== undefined) {
        container.sidebarProvider.queueEvolutionReveal(result.evolution)
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
}

export function deactivate(): void {}
