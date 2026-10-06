import type { Plugin, PluginOptions } from "@opencode-ai/plugin"

import { createServerHooks } from "./adapters/opencode/create-server-hooks.ts"
import { createSessionMessagesFetcher } from "./adapters/opencode/session-messages.ts"
import { createBestEffortDigitalPetToastNotifier } from "./adapters/opencode/digital-pet-toast.ts"
import { createSqliteDigitalPetRepository } from "./adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { loadGlobalDigitalPetSettings } from "./config/global-digital-pet-settings.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import type { StageThresholds } from "@jcendal/digital-pet-core/domain/evolution.ts"
export { createCommandConfig } from "./adapters/opencode/create-server-hooks.ts"
export { DIGIMON_DATA } from "@jcendal/digital-pet-core/data/digimon-data.ts"
export type { DigimonId, DigimonRecord, DigimonStage } from "@jcendal/digital-pet-core/data/digimon-data.ts"

const getStringOption = (options: PluginOptions | undefined, name: string): string | undefined => {
  const value = options?.[name]
  return typeof value === "string" ? value : undefined
}

const toEvolutionThresholds = (settings: ResolvedDigitalPetSettings): StageThresholds =>
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
  const settings = await loadGlobalDigitalPetSettings()
  const repository = await createSqliteDigitalPetRepository({
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
    notify: createBestEffortDigitalPetToastNotifier(
      async (payload) => (await input.client.tui.showToast({ body: payload })).data ?? false,
    ),
  })
}

const entryPlugin = {
  id: "opencode-digital-pet",
  server: plugin,
} as const

export default entryPlugin
