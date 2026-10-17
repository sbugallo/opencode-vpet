import { rm } from "node:fs/promises"

await rm("dist", { recursive: true, force: true })

const pluginResult = await Bun.build({
  entrypoints: ["./src/index.ts", "./src/tui.tsx"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  splitting: false,
  external: [
    "@opencode/plugin",
    "@opencode/plugin/tui",
    "@opencode/plugin/rpc",
    "@opentui/core",
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

// OpenCode resolves local plugin installs through the target directory's own
// package.json, exposing the server and TUI entries as "." and "./tui".
await Bun.write(
  "dist/package.json",
  `${JSON.stringify(
    {
      name: "@sbugallo/opencode-vpet-local",
      private: true,
      type: "module",
      main: "./index.js",
      exports: {
        ".": "./index.js",
        "./tui": "./tui.js",
      },
    },
    null,
    2,
  )}\n`,
)

const declarations = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"])
if (declarations.exitCode !== 0) throw new Error(new TextDecoder().decode(declarations.stderr))
