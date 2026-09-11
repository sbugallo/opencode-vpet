import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const resolveCursorUserDir = (): string => {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Cursor", "User")
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    return join(appData, "Cursor", "User")
  }
  return join(homedir(), ".config", "Cursor", "User")
}

export const resolveStateVscdbPath = (): string => join(resolveCursorUserDir(), "globalStorage", "state.vscdb")

export const resolveHooksJsonPath = (): string => join(homedir(), ".cursor", "hooks.json")

export const resolveHookEventsPath = (): string =>
  process.env.VPET_HOOK_EVENTS_PATH ?? join(homedir(), ".cursor", "vpet-hook-events.jsonl")

export const resolveHookBridgePath = (): string => {
  const override = process.env.VPET_HOOK_BRIDGE_PATH
  if (override !== undefined && override.length > 0) return override
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hook-bridge.js")
}
