import { copyFile, mkdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build, context } from "esbuild"

const packageRoot = dirname(fileURLToPath(import.meta.url))
const distDirectory = resolve(packageRoot, "dist")
const require = createRequire(import.meta.url)
const wasmSource = require.resolve("sql.js/dist/sql-wasm.wasm")
await rm(distDirectory, { recursive: true, force: true })
await mkdir(distDirectory, { recursive: true })
await copyFile(wasmSource, resolve(distDirectory, "sql-wasm.wasm"))

const options = {
  entryPoints: [resolve(packageRoot, "src/extension.ts")],
  outfile: resolve(distDirectory, "extension.js"),
  bundle: true,
  platform: "node",
  target: "node22.13",
  format: "cjs",
  external: ["vscode", "bun:sqlite"],
  define: { __DIGITAL_PET_BUNDLE__: "true", "import.meta.url": "undefined" },
  minify: true,
  sourcemap: false,
  logLevel: "info",
}

if (process.argv.includes("--watch")) {
  const buildContext = await context(options)
  await buildContext.watch()
  console.log("Watching cursor-digital-pet")
} else {
  await build(options)
}
