import * as vscode from "vscode"

import type { HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"

export type VpetExtensionSettings = {
  readonly databasePath?: string
  readonly settleDelayMs: number
}

export const getVpetExtensionSettings = (): VpetExtensionSettings => {
  const configuration = vscode.workspace.getConfiguration("vpet")
  const databasePath = configuration.get<string>("databasePath", "").trim()
  const settings: VpetExtensionSettings = {
    settleDelayMs: configuration.get<number>("usage.settleDelayMs", 4000),
  }
  if (databasePath.length > 0) {
    return { ...settings, databasePath }
  }
  return settings
}

export const toDatabaseOptions = (
  settings: VpetExtensionSettings,
): HostPathOptions & { readonly databasePath?: string } =>
  settings.databasePath === undefined ? {} : { databasePath: settings.databasePath }
