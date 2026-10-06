import { spawnSync } from "node:child_process"
import { readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { restorePackageJson, stripInternalDependencies } from "./strip-internal-deps.ts"

type JsonObject = { readonly [key: string]: unknown }

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const collectPaths = (value: unknown, paths: Set<string>): void => {
  if (typeof value === "string") {
    paths.add(value)
    return
  }
  if (!isJsonObject(value)) return
  for (const nestedValue of Object.values(value)) collectPaths(nestedValue, paths)
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const backupPath = resolve(packageRoot, ".package.json.publish.bak")
const exists = async (path: string): Promise<boolean> => (await stat(path).catch(() => undefined)) !== undefined

if (await exists(backupPath)) {
  await restorePackageJson(packageRoot, await readFile(backupPath, "utf8"))
  await rm(backupPath, { force: true })
}

const originalSource = await stripInternalDependencies(packageRoot)
await writeFile(backupPath, originalSource)

try {
  const build = spawnSync(process.execPath, ["esbuild.mjs"], { cwd: packageRoot, stdio: "inherit" })
  if (build.error) throw build.error
  if (build.status !== 0) throw new Error("OpenCode build failed during prepack.")

  const packageJson: unknown = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"))
  if (!isJsonObject(packageJson)) throw new Error("package.json must contain an object.")

  const publishedPaths = new Set<string>()
  collectPaths(packageJson.main, publishedPaths)
  collectPaths(packageJson.types, publishedPaths)
  collectPaths(packageJson.exports, publishedPaths)
  collectPaths(packageJson.bin, publishedPaths)

  for (const publishedPath of publishedPaths) {
    const artifactPath = resolve(packageRoot, publishedPath)
    const artifact = await stat(artifactPath).catch(() => undefined)
    if (artifact === undefined || !artifact.isFile() || artifact.size === 0) {
      throw new Error(`Published artifact is missing or empty: ${publishedPath}`)
    }
  }

  const binPaths = new Set<string>()
  collectPaths(packageJson.bin, binPaths)
  const cliPath = binPaths.values().next().value
  if (typeof cliPath !== "string") throw new Error("Package metadata does not define a bin path.")

  const cliResult = spawnSync(process.execPath, [resolve(packageRoot, cliPath), "--help"], {
    cwd: packageRoot,
    encoding: "utf8",
  })
  if (cliResult.error) throw cliResult.error
  if (cliResult.status !== 0) {
    throw new Error(`Node CLI help failed: ${cliPath}\n${cliResult.stderr}`)
  }
} catch (error) {
  await restorePackageJson(packageRoot, originalSource)
  await rm(backupPath, { force: true })
  throw error
}
