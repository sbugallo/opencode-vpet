import { join } from "node:path"
import * as vscode from "vscode"

import { installDigitalPetHooks } from "../adapters/cursor/install-hooks.ts"

export const ensureHooksInstalled = async (context: vscode.ExtensionContext): Promise<void> => {
  const key = "digital-pet.hooksInstalled"
  if (context.globalState.get<boolean>(key) === true) return

  const choice = await vscode.window.showInformationMessage(
    "Cursor Digital Pet needs to register hooks in ~/.cursor/hooks.json to track Agent usage.",
    "Install hooks",
    "Not now",
  )
  if (choice !== "Install hooks") return

  const bridgePath = join(context.extensionPath, "hook-bridge.js")
  const result = installDigitalPetHooks(bridgePath)
  await context.globalState.update(key, true)
  vscode.window.showInformationMessage(`Digital Pet hooks installed at ${result.hooksPath}`)
}
