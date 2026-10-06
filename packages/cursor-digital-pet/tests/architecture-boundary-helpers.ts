import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

export const FORBIDDEN_PRESENTATION_IMPORTS = [
  "vscode",
  "/adapters/",
  "/bootstrap/",
  "node:fs",
  "node:path",
  "sql.js",
  "/webview/sidebar/",
] as const

export const FORBIDDEN_SHARED_IMPORTS = ["vscode", "/adapters/", "/webview/", "/bootstrap/"] as const

export const FORBIDDEN_SQLITE_ADAPTER_IMPORTS = ["vscode"] as const

export const FORBIDDEN_VSCODE_ADAPTER_IMPORTS = ["/adapters/cursor/", "/adapters/sqlite/", "/bootstrap/"] as const

export const FORBIDDEN_CURSOR_ADAPTER_IMPORTS = ["vscode", "/webview/"] as const

export const FORBIDDEN_SIDEBAR_IMPORTS = ["vscode"] as const

export const SIDEBAR_VSCODE_EXCEPTION = "webview/sidebar/provider.ts"

const matchesForbiddenImport = (specifier: string, forbidden: string): boolean => {
  if (forbidden.startsWith("/")) return specifier.includes(forbidden)
  return specifier === forbidden
}

export const findForbiddenImports = (
  sourcePath: string,
  source: string,
  forbiddenImports: readonly string[],
): readonly string[] => {
  const importSpecifiers = source.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g)
  const violations: string[] = []
  for (const match of importSpecifiers) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined && forbiddenImports.some((forbidden) => matchesForbiddenImport(specifier, forbidden)))
      violations.push(`${sourcePath}: ${specifier}`)
  }
  return violations
}

export const scanForbiddenImports = async (
  directory: string,
  forbiddenImports: readonly string[],
  ignorePaths: readonly string[] = [],
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const violations: string[] = []
  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (ignorePaths.some((ignored) => entryPath.endsWith(ignored))) continue
    if (entry.isDirectory()) violations.push(...(await scanForbiddenImports(entryPath, forbiddenImports, ignorePaths)))
    else if (entry.isFile() && entry.name.endsWith(".ts"))
      violations.push(...findForbiddenImports(entryPath, await readFile(entryPath, "utf8"), forbiddenImports))
  }
  return violations.sort()
}

export const scanPresentationImports = (directory: string): Promise<readonly string[]> =>
  scanForbiddenImports(directory, FORBIDDEN_PRESENTATION_IMPORTS)

export const scanSharedImports = (directory: string): Promise<readonly string[]> =>
  scanForbiddenImports(directory, FORBIDDEN_SHARED_IMPORTS)

export const scanSidebarImports = (directory: string): Promise<readonly string[]> =>
  scanForbiddenImports(directory, FORBIDDEN_SIDEBAR_IMPORTS, [SIDEBAR_VSCODE_EXCEPTION])
