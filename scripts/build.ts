import { rm } from "node:fs/promises"

await rm("dist", { recursive: true, force: true })

const pluginResult = await Bun.build({
  entrypoints: ["./src/index.ts", "./src/tui.tsx"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  splitting: false,
  external: [
    "@opencode-ai/plugin",
    "@opencode-ai/plugin/tui",
    "@opencode-ai/sdk",
    "@opencode-ai/sdk/v2",
    "@opentui/core",
    "@opentui/keymap",
    "@opentui/solid",
    "solid-js",
  ],
  sourcemap: "linked",
})

const cliResult = await Bun.build({
  entrypoints: ["./src/cli.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  splitting: false,
  sourcemap: "linked",
})

if (!pluginResult.success || !cliResult.success) {
  await rm("dist", { recursive: true, force: true })
  throw new Error("Build failed.")
}

const declarations = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"])
if (declarations.exitCode !== 0) throw new Error(new TextDecoder().decode(declarations.stderr))
