import { existsSync } from "node:fs"
import { cp, rm } from "node:fs/promises"
import { resolve } from "node:path"

const packageRoot = resolve(import.meta.dir, "..")
const workspaceSource = resolve(packageRoot, "../vpet-animation/src")
const stagedSource = resolve(packageRoot, "build/vpet-animation-src")

if (existsSync(workspaceSource)) {
  await rm(stagedSource, { recursive: true, force: true })
  await cp(workspaceSource, stagedSource, { recursive: true })
} else if (!existsSync(stagedSource)) {
  throw new Error("Missing vpet-animation sources. Expected ../vpet-animation/src or build/vpet-animation-src.")
}
