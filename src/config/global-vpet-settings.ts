import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { DEFAULT_VPET_SETTINGS } from "./defaults.ts"
import { normalizeVpetSettings } from "./normalize.ts"
import type { ResolvedVpetSettings } from "./types.ts"

type PathApi = Readonly<{
  join: (...paths: readonly string[]) => string
}>

export type GlobalVpetConfigOptions = Readonly<{
  readonly env?: Readonly<{
    readonly APPDATA?: string
  }>
  readonly home?: string
  readonly pathApi?: PathApi
  readonly platform?: NodeJS.Platform
}>

export const resolveGlobalVpetConfigPath = (options: GlobalVpetConfigOptions = {}): string => {
  const pathApi = options.pathApi ?? { join }
  const env = options.env ?? process.env
  const home = options.home ?? homedir()

  if ((options.platform ?? process.platform) === "win32") {
    const { APPDATA } = env
    return pathApi.join(APPDATA ?? pathApi.join(home, "AppData", "Roaming"), "opencode-vpet.json")
  }

  return pathApi.join(home, ".config", "opencode-vpet.json")
}

export const loadGlobalVpetSettings = async (options: GlobalVpetConfigOptions = {}): Promise<ResolvedVpetSettings> => {
  try {
    return normalizeVpetSettings(JSON.parse(await readFile(resolveGlobalVpetConfigPath(options), "utf8")))
  } catch {
    return DEFAULT_VPET_SETTINGS
  }
}

export const loadGlobalVpetSettingsSync = (options: GlobalVpetConfigOptions = {}): ResolvedVpetSettings => {
  try {
    return normalizeVpetSettings(JSON.parse(readFileSync(resolveGlobalVpetConfigPath(options), "utf8")))
  } catch {
    return DEFAULT_VPET_SETTINGS
  }
}
