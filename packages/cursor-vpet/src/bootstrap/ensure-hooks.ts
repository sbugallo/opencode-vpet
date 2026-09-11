import { join } from "node:path"
import * as vscode from "vscode"

import { installVpetHooks } from "../adapters/cursor/install-hooks.ts"

export const ensureHooksInstalled = async (context: vscode.ExtensionContext): Promise<void> => {
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
