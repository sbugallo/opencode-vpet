import * as vscode from "vscode"

import type { HostPathOptions } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"

export type DigitalPetExtensionSettings = {
  readonly databasePath?: string
  readonly settleDelayMs: number
}

export const getDigitalPetExtensionSettings = (): DigitalPetExtensionSettings => {
  const configuration = vscode.workspace.getConfiguration("digital-pet")
  const databasePath = configuration.get<string>("databasePath", "").trim()
  const settings: DigitalPetExtensionSettings = {
    settleDelayMs: configuration.get<number>("usage.settleDelayMs", 4000),
  }
  if (databasePath.length > 0) {
    return { ...settings, databasePath }
  }
  return settings
}

export const toDatabaseOptions = (
  settings: DigitalPetExtensionSettings,
): HostPathOptions & { readonly databasePath?: string } =>
  settings.databasePath === undefined ? {} : { databasePath: settings.databasePath }

export const DEV_TOOLS_CONTEXT = "cursorDigitalPet.devToolsEnabled"

export const isDevToolsEnabled = (extensionMode: vscode.ExtensionMode): boolean => {
  if (process.env.CURSOR_DIGITAL_PET_DEV === "1") return true
  if (extensionMode === vscode.ExtensionMode.Development) return true
  return vscode.workspace.getConfiguration("digital-pet").get<boolean>("devTools", false)
}

export const syncDevToolsContext = async (extensionMode: vscode.ExtensionMode): Promise<void> => {
  await vscode.commands.executeCommand("setContext", DEV_TOOLS_CONTEXT, isDevToolsEnabled(extensionMode))
}
