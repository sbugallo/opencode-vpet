import { readFile, rm } from "node:fs/promises"
import { resolve } from "node:path"

import { removeStagedChangelog } from "../../../scripts/stage-changelog.ts"
import { restorePackageJson } from "./strip-workspace-deps.ts"

const packageRoot = resolve(import.meta.dir, "..")
const backupPath = resolve(packageRoot, ".package.json.publish.bak")

if (await Bun.file(backupPath).exists()) {
  const originalSource = await readFile(backupPath, "utf8")
  await restorePackageJson(packageRoot, originalSource)
  await rm(backupPath, { force: true })
}

await removeStagedChangelog(packageRoot)
