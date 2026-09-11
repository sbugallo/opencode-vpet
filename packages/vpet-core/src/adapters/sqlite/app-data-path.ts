import { homedir } from "node:os"
import { join } from "node:path"

const APP_DIRECTORY_NAME = "opencode-vpet"
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
  return join(options.appDataRoot ?? resolveDefaultAppDataRoot(), APP_DIRECTORY_NAME)
}

export const resolveHostDatabasePath = (options: HostPathOptions = {}): string => {
  return join(resolveHostDataDirectory(options), DATABASE_FILE_NAME)
}
