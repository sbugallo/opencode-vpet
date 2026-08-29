import type { Plugin, PluginOptions } from "@opencode-ai/plugin"

import { createServerHooks } from "./adapters/opencode/create-server-hooks.ts"
import { createSessionMessagesFetcher } from "./adapters/opencode/session-messages.ts"
import { createBestEffortVpetToastNotifier } from "./adapters/opencode/vpet-toast.ts"
import { createSqliteVpetRepository } from "./adapters/sqlite/sqlite-vpet-write-store.ts"
import { loadGlobalVpetSettings } from "./config/global-vpet-settings.ts"
import type { ResolvedVpetSettings } from "./config/types.ts"
import type { StageThresholds } from "./domain/evolution.ts"
export { createCommandConfig } from "./adapters/opencode/create-server-hooks.ts"
export { DIGIMON_DATA } from "./data/digimon-data.js"
export type { DigimonId, DigimonRecord, DigimonStage } from "./data/digimon-data.js"

const getStringOption = (options: PluginOptions | undefined, name: string): string | undefined => {
  const value = options?.[name]
  return typeof value === "string" ? value : undefined
}

const toEvolutionThresholds = (settings: ResolvedVpetSettings): StageThresholds =>
  Object.freeze({
    0: settings.stageThresholds.egg,
    1: settings.stageThresholds.babyI,
    2: settings.stageThresholds.babyII,
    3: settings.stageThresholds.child,
    4: settings.stageThresholds.adult,
    5: settings.stageThresholds.perfect,
    6: settings.stageThresholds.ultimate,
    7: settings.stageThresholds.superUltimate,
  })

export const plugin: Plugin = async (input, options) => {
  const appDataRoot = getStringOption(options, "appDataRoot")
  const databasePath = getStringOption(options, "databasePath")
  const settings = await loadGlobalVpetSettings()
  const repository = await createSqliteVpetRepository({
    ...(appDataRoot === undefined ? {} : { appDataRoot }),
    ...(databasePath === undefined ? {} : { databasePath }),
  })
  return createServerHooks({
    repository,
    resource: repository,
    evolutionThresholds: toEvolutionThresholds(settings),
    fetchMessages: createSessionMessagesFetcher(input.client),
    language: settings.language,
    notificationsEnabled: settings.notifications,
    notify: createBestEffortVpetToastNotifier(
      async (payload) => (await input.client.tui.showToast({ body: payload })).data ?? false,
    ),
  })
}

const entryPlugin = {
  id: "opencode-vpet",
  server: plugin,
} as const

export default entryPlugin
