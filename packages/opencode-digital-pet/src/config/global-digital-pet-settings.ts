import { existsSync, readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { normalizeDigitalPetSettings } from "@jcendal/digital-pet-core/config/normalize.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"

type PathApi = Readonly<{
  join: (...paths: readonly string[]) => string
}>

export type GlobalDigitalPetConfigOptions = Readonly<{
  readonly env?: NodeJS.ProcessEnv
  readonly home?: string
  readonly pathApi?: PathApi
  readonly platform?: NodeJS.Platform
}>

export const resolveGlobalDigitalPetConfigPath = (options: GlobalDigitalPetConfigOptions = {}): string => {
  const pathApi = options.pathApi ?? { join }
  const env = options.env ?? process.env
  const home = options.home ?? homedir()

  const configDirectory =
    (options.platform ?? process.platform) === "win32"
      ? pathApi.join(env["APPDATA"] ?? pathApi.join(home, "AppData", "Roaming"))
      : pathApi.join(home, ".config")
  const currentPath = pathApi.join(configDirectory, "opencode-digital-pet.json")
  const legacyPath = pathApi.join(configDirectory, "opencode-vpet.json")
  if (!existsSync(currentPath) && existsSync(legacyPath)) return legacyPath
  return currentPath
}

export const loadGlobalDigitalPetSettings = async (
  options: GlobalDigitalPetConfigOptions = {},
): Promise<ResolvedDigitalPetSettings> => {
  try {
    return normalizeDigitalPetSettings(JSON.parse(await readFile(resolveGlobalDigitalPetConfigPath(options), "utf8")))
  } catch {
    return DEFAULT_DIGITAL_PET_SETTINGS
  }
}

export const loadGlobalDigitalPetSettingsSync = (
  options: GlobalDigitalPetConfigOptions = {},
): ResolvedDigitalPetSettings => {
  try {
    return normalizeDigitalPetSettings(JSON.parse(readFileSync(resolveGlobalDigitalPetConfigPath(options), "utf8")))
  } catch {
    return DEFAULT_DIGITAL_PET_SETTINGS
  }
}
