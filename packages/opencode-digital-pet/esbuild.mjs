import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

import { build } from "esbuild"

const packageRoot = dirname(fileURLToPath(import.meta.url))
const distRoot = resolve(packageRoot, "dist")
const require = createRequire(import.meta.url)
const tscPath = require.resolve("typescript/bin/tsc")

const stageSources = async (packageName) => {
  const source = resolve(packageRoot, `../${packageName}/src`)
  const target = resolve(packageRoot, `build/${packageName}-src`)
  await rm(target, { recursive: true, force: true })
  await cp(source, target, { recursive: true })
}

const runTsc = (config) => {
  const result = spawnSync(process.execPath, [tscPath, "-p", config], {
    cwd: packageRoot,
    stdio: "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Type declarations failed: ${config}`)
}

const declarationFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await declarationFiles(path)))
    else if (entry.name.endsWith(".d.ts")) files.push(path)
  }
  return files
}

const toJs = (specifier) => specifier.replace(/\.tsx?$/, ".js")

const rewriteDeclarations = async () => {
  for (const file of await declarationFiles(distRoot)) {
    const source = await readFile(file, "utf8")
    let rewritten = source.replace(
      /(["'])(@jcendal\/digital-pet-(core|animation)\/([^"']+))(["'])/g,
      (_match, opening, _specifier, packageName, subpath, closing) => {
        const target = join(distRoot, `digital-pet-${packageName}`, toJs(subpath))
        const path = relative(dirname(file), target).replaceAll("\\", "/")
        return `${opening}${path.startsWith(".") ? path : `./${path}`}${closing}`
      },
    )
    rewritten = rewritten.replace(
      /(["'])(\.\.?\/[^"']+\.tsx?)(["'])/g,
      (_match, opening, path, closing) => `${opening}${toJs(path)}${closing}`,
    )
    if (rewritten !== source) await writeFile(file, rewritten)
  }
}

await stageSources("digital-pet-core")
await stageSources("digital-pet-animation")
await rm(distRoot, { recursive: true, force: true })
await mkdir(distRoot, { recursive: true })

await build({
  entryPoints: [
    resolve(packageRoot, "src/index.ts"),
    resolve(packageRoot, "src/tui.tsx"),
    resolve(packageRoot, "src/dev/attach-dev-tools.ts"),
  ],
  outbase: resolve(packageRoot, "src"),
  outdir: distRoot,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  splitting: false,
  sourcemap: false,
  external: [
    "bun:*",
    "@opencode-ai/plugin",
    "@opencode-ai/sdk",
    "@opentui/core",
    "@opentui/keymap",
    "@opentui/solid",
    "solid-js",
  ],
  logLevel: "info",
})

await build({
  entryPoints: [resolve(packageRoot, "src/cli.ts")],
  outfile: resolve(distRoot, "cli.js"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: false,
  logLevel: "info",
})

runTsc("tsconfig.build.json")
runTsc("tsconfig.digital-pet-core-declarations.json")
runTsc("tsconfig.digital-pet-animation-declarations.json")
await rewriteDeclarations()
