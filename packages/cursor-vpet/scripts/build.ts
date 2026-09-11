import { copyFile, mkdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"

import { stageChangelog } from "./stage-changelog.ts"

const require = createRequire(import.meta.url)
const packageRoot = resolve(import.meta.dir, "..")
const distDirectory = resolve(packageRoot, "dist")
const wasmSource = require.resolve("sql.js/dist/sql-wasm.wasm")

await rm(distDirectory, { recursive: true, force: true })
await mkdir(distDirectory, { recursive: true })
await stageChangelog(packageRoot)

const result = await Bun.build({
  entrypoints: ["./src/extension.ts"],
  outdir: "./dist",
  target: "node",
  format: "cjs",
  external: ["vscode"],
  minify: true,
  sourcemap: false,
})

if (!result.success) {
  throw new Error("cursor-vpet build failed")
}

await copyFile(wasmSource, resolve(distDirectory, "sql-wasm.wasm"))
