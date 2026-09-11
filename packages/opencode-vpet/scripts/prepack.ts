import { rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { removeStagedChangelog, stageChangelog } from "../../../scripts/stage-changelog.ts"
import { restorePackageJson, stripWorkspaceDependencies } from "./strip-workspace-deps.ts"

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

const packageRoot = resolve(import.meta.dir, "..")
const backupPath = resolve(packageRoot, ".package.json.publish.bak")

const originalSource = await stripWorkspaceDependencies(packageRoot)
if (!(await Bun.file(backupPath).exists())) {
  await writeFile(backupPath, originalSource)
}

try {
  await stageChangelog(packageRoot)
  await Bun.$`bun run build`

  const packageJson: unknown = JSON.parse(await Bun.file(resolve(packageRoot, "package.json")).text())
  if (!isJsonObject(packageJson)) throw new Error("package.json must contain an object.")

  const publishedPaths = new Set<string>()
  collectPaths(packageJson.main, publishedPaths)
  collectPaths(packageJson.types, publishedPaths)
  collectPaths(packageJson.exports, publishedPaths)
  collectPaths(packageJson.bin, publishedPaths)

  for (const publishedPath of publishedPaths) {
    const artifactPath = resolve(packageRoot, publishedPath)
    const artifact = Bun.file(artifactPath)
    if (!(await artifact.exists()) || artifact.size === 0) {
      throw new Error(`Published artifact is missing or empty: ${publishedPath}`)
    }
  }

  const binPaths = new Set<string>()
  collectPaths(packageJson.bin, binPaths)
  const cliPath = binPaths.values().next().value
  if (typeof cliPath !== "string") throw new Error("Package metadata does not define a bin path.")

  const cliResult = Bun.spawnSync(["node", resolve(packageRoot, cliPath), "--help"], {
    stdout: "inherit",
    stderr: "inherit",
  })
  if (cliResult.exitCode !== 0) throw new Error(`Node CLI help failed: ${cliPath}`)
} catch (error) {
  await restorePackageJson(packageRoot, originalSource)
  await rm(backupPath, { force: true })
  await removeStagedChangelog(packageRoot)
  throw error
}
