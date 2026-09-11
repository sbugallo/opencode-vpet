import { existsSync } from "node:fs"
import { cp, rm } from "node:fs/promises"
import { resolve } from "node:path"

const packageRoot = resolve(import.meta.dir, "..")
const workspaceSource = resolve(packageRoot, "../vpet-core/src")
const stagedSource = resolve(packageRoot, "build/vpet-core-src")

if (existsSync(workspaceSource)) {
  await rm(stagedSource, { recursive: true, force: true })
  await cp(workspaceSource, stagedSource, { recursive: true })
} else if (!existsSync(stagedSource)) {
  throw new Error("Missing vpet-core sources. Expected ../vpet-core/src or build/vpet-core-src.")
}
