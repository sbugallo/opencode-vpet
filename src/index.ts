import { Plugin } from "@opencode/plugin"

import { setupVpetServer } from "./adapters/opencode/server-plugin.ts"
import { createSqliteVpetRepository } from "./adapters/sqlite/sqlite-vpet-write-store.ts"

export { createCommandConfig } from "./adapters/opencode/server-plugin.ts"
export { DIGIMON_DATA } from "./data/digimon-data.js"
export type { DigimonId, DigimonRecord, DigimonStage } from "./data/digimon-data.js"

export const plugin = Plugin.define({
  id: "opencode-vpet",
  setup: (context) => setupVpetServer(context, { openRepository: createSqliteVpetRepository }),
})

export default plugin
