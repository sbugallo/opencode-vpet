import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import semver from "semver"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const workspaces = ["digital-pet-core", "digital-pet-animation", "opencode-digital-pet", "cursor-digital-pet"]
const manifests = new Map()

for (const workspace of workspaces) {
  const path = resolve(root, "packages", workspace, "package.json")
  const manifest = JSON.parse(await readFile(path, "utf8"))
  if (semver.valid(manifest.version) !== manifest.version) {
    throw new Error(`${workspace} must have an exact SemVer version.`)
  }
  manifests.set(manifest.name, manifest)
}

for (const manifest of manifests.values()) {
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    const internal = manifests.get(name)
    if (internal?.private !== true) continue
    if (version !== internal.version) {
      throw new Error(`${manifest.name} depends on ${name}@${version}, but the workspace is ${internal.version}.`)
    }
  }
}

console.log("Workspace dependency versions match their private packages.")
