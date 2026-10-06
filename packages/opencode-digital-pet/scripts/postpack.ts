import { readFile, rm, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { restorePackageJson } from "./strip-internal-deps.ts"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const backupPath = resolve(packageRoot, ".package.json.publish.bak")

if ((await stat(backupPath).catch(() => undefined)) !== undefined) {
  const originalSource = await readFile(backupPath, "utf8")
  await restorePackageJson(packageRoot, originalSource)
  await rm(backupPath, { force: true })
}
