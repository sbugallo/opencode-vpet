import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

export const FORBIDDEN_DOMAIN_IMPORTS = [
  "/data/",
  "/application/",
  "/adapters/",
  "/tui/",
  "/commands/",
  "/config/",
  "@opencode-ai/",
  "@opentui/",
  "solid-js",
  "bun:sqlite",
  "node:fs",
] as const
export const FORBIDDEN_APPLICATION_IMPORTS = [
  "/config/",
  "node:fs",
  "node:os",
  "node:path",
  "/persistence/",
  "/runtime/",
  "/adapters/sqlite/",
  "/adapters/opencode/",
  "/tui/",
  "/commands/",
  "@opencode-ai/",
  "@opentui/",
  "solid-js",
  "bun:sqlite",
  "sqlite-vpet-schema",
  "bun-sqlite-driver",
] as const
export const FORBIDDEN_TUI_PRESENTATION_IMPORTS = [
  "/config/global-vpet-settings",
  "/persistence/",
  "/runtime/",
  "/adapters/sqlite/",
  "bun:sqlite",
  "sqlite-vpet-schema",
  "bun-sqlite-driver",
  "sqlite-migrations",
] as const
export const FORBIDDEN_TUI_ANIMATION_IMPORTS = [
  "/application/",
  "/domain/",
  "/persistence/",
  "/runtime/",
  "/adapters/sqlite/",
  "bun:sqlite",
] as const
export const FORBIDDEN_ADAPTER_IMPORTS = ["/tui/", "../tui.tsx", "../index.ts", "/persistence/", "/runtime/"] as const
export const FORBIDDEN_LEGACY_IMPORTS = ["/persistence/", "/runtime/", "/tui/sidebar-state.ts"] as const
export const FORBIDDEN_SERVER_HOOK_IMPORTS = ["/adapters/sqlite/", "/application/ports/resource-lifecycle"] as const
export const TUI_PRIVATE_ANIMATION_MODULES = [
  "monster-action-policy.ts",
  "monster-animation.ts",
  "monster-artwork-mirror.ts",
  "monster-walking-policy.ts",
] as const

const CORE_PARTNER_FIELDS = [
  "partnerId",
  "generation",
  "currentNodeId",
  "gauge",
  "isTerminal",
  "createdAt",
  "retiredAt",
] as const
const TECHNICAL_LIFECYCLE_METHODS = ["close", "dispose"] as const

export const findForbiddenImports = (
  sourcePath: string,
  source: string,
  forbiddenImports: readonly string[],
): readonly string[] => {
  const importSpecifiers = source.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g)
  const violations: string[] = []
  for (const match of importSpecifiers) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined && forbiddenImports.some((forbidden) => specifier.includes(forbidden)))
      violations.push(`${sourcePath}: ${specifier}`)
  }
  return violations
}

export const scanForbiddenImports = async (
  directory: string,
  forbiddenImports: readonly string[],
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const violations: string[] = []
  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) violations.push(...(await scanForbiddenImports(entryPath, forbiddenImports)))
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
      violations.push(...findForbiddenImports(entryPath, await readFile(entryPath, "utf8"), forbiddenImports))
  }
  return violations.sort()
}

export const scanApplicationImports = (directory: string): Promise<readonly string[]> =>
  scanForbiddenImports(directory, FORBIDDEN_APPLICATION_IMPORTS)
export const scanTuiPresentationImports = (directory: string): Promise<readonly string[]> =>
  scanForbiddenImports(directory, FORBIDDEN_TUI_PRESENTATION_IMPORTS)

const findDuplicateCorePartnerDeclarations = (sourcePath: string, source: string): readonly string[] => {
  const violations: string[] = []
  for (const declaration of source.matchAll(/export\s+type\s+Partner\s*=\s*\{([\s\S]*?)\}/g)) {
    const body = declaration[1]
    if (body !== undefined && CORE_PARTNER_FIELDS.every((field) => new RegExp(`\\b${field}\\s*:`).test(body)))
      violations.push(`${sourcePath}: duplicate Partner core state`)
  }
  return violations
}

export const scanDuplicateCorePartnerDeclarations = async (directory: string): Promise<readonly string[]> =>
  scanSources(directory, findDuplicateCorePartnerDeclarations)

const findTechnicalLifecyclePorts = (sourcePath: string, source: string): readonly string[] => {
  const violations: string[] = []
  for (const declaration of source.matchAll(/export\s+(?:type|interface)\s+\w+[\s\S]*?[={]([\s\S]*?)[}]/g)) {
    const body = declaration[1]
    if (
      body !== undefined &&
      TECHNICAL_LIFECYCLE_METHODS.some((method) => new RegExp(`\\b${method}\\s*[:(]`).test(body))
    )
      violations.push(`${sourcePath}: technical lifecycle port`)
  }
  return violations
}

export const scanTechnicalLifecyclePorts = async (directory: string): Promise<readonly string[]> =>
  scanSources(directory, findTechnicalLifecyclePorts)

const scanSources = async (
  directory: string,
  scan: (sourcePath: string, source: string) => readonly string[],
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const violations: string[] = []
  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) violations.push(...(await scanSources(entryPath, scan)))
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
      violations.push(...scan(entryPath, await readFile(entryPath, "utf8")))
  }
  return violations.sort()
}
