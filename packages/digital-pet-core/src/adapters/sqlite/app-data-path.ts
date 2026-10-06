import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const APP_DIRECTORY_NAME = "opencode-digital-pet"
const LEGACY_APP_DIRECTORY_NAME = "opencode-vpet"
const DATABASE_FILE_NAME = "pet.db"

export type HostPathOptions = {
  readonly appDataRoot?: string
}

const resolveDefaultAppDataRoot = (): string => {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support")
  }

  if (process.platform === "win32") {
    const { APPDATA } = process.env
    return APPDATA ?? join(homedir(), "AppData", "Roaming")
  }

  return join(homedir(), ".local", "share")
}

export const resolveHostDataDirectory = (options: HostPathOptions = {}): string => {
  const root = options.appDataRoot ?? resolveDefaultAppDataRoot()
  const currentDirectory = join(root, APP_DIRECTORY_NAME)
  const legacyDirectory = join(root, LEGACY_APP_DIRECTORY_NAME)
  if (
    !existsSync(join(currentDirectory, DATABASE_FILE_NAME)) &&
    existsSync(join(legacyDirectory, DATABASE_FILE_NAME))
  ) {
    return legacyDirectory
  }
  return currentDirectory
}

export const resolveHostDatabasePath = (options: HostPathOptions = {}): string => {
  return join(resolveHostDataDirectory(options), DATABASE_FILE_NAME)
}
