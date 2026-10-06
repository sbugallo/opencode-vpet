import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { DIGITAL_PET_HOOK_MARKER } from "../../shared/constants/cursor.ts"
import { resolveHooksJsonPath } from "./paths.ts"

export type HooksJson = {
  readonly version: number
  readonly hooks: Record<string, readonly { readonly command: string }[]>
}

const parseHooksJson = (raw: string): HooksJson => {
  const parsed = JSON.parse(raw) as HooksJson
  if (typeof parsed.version !== "number" || typeof parsed.hooks !== "object") {
    throw new Error("Invalid hooks.json shape")
  }
  return parsed
}

const isDigitalPetHook = (entry: { readonly command: string }): boolean =>
  entry.command.includes(DIGITAL_PET_HOOK_MARKER)

export const installDigitalPetHooks = (bridgePath: string): { readonly hooksPath: string } => {
  const hooksPath = resolveHooksJsonPath()
  const command = `node "${bridgePath}"`

  mkdirSync(dirname(hooksPath), { recursive: true })

  let config: HooksJson
  try {
    config = parseHooksJson(readFileSync(hooksPath, "utf8"))
  } catch {
    config = { version: 1, hooks: {} }
  }

  const ensureHook = (name: string): void => {
    const existing = config.hooks[name] ?? []
    config.hooks[name] = [...existing.filter((entry) => !isDigitalPetHook(entry)), { command }]
  }

  ensureHook("beforeSubmitPrompt")
  ensureHook("stop")

  writeFileSync(hooksPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
  return { hooksPath }
}

export const uninstallDigitalPetHooks = (): boolean => {
  const hooksPath = resolveHooksJsonPath()
  try {
    const config = parseHooksJson(readFileSync(hooksPath, "utf8"))
    const nextHooks: HooksJson["hooks"] = {}
    for (const [name, entries] of Object.entries(config.hooks)) {
      const filtered = entries.filter((entry) => !isDigitalPetHook(entry))
      if (filtered.length > 0) nextHooks[name] = filtered
    }
    writeFileSync(hooksPath, `${JSON.stringify({ ...config, hooks: nextHooks }, null, 2)}\n`, "utf8")
    return true
  } catch {
    return false
  }
}
