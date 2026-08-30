#!/usr/bin/env node
import { readFile } from "node:fs/promises"

import { installGlobalPlugin } from "./cli/install.ts"

const HELP = `Usage: opencode-vpet <init|update> [--dry-run]

Commands:
  init       Install the current package version through OpenCode's global plugin installer.
  update     Reinstall the current package version through the same installer.

Options:
  --dry-run  Show the native OpenCode command without running it.
  --help      Show this help text.
`

type Command = "init" | "update"

type ParsedArguments =
  | Readonly<{ readonly kind: "help" }>
  | Readonly<{ readonly kind: "command"; readonly command: Command; readonly dryRun: boolean }>
  | Readonly<{ readonly kind: "invalid"; readonly message: string }>

type PackageManifest = Readonly<{ readonly name: "@sbugallo/opencode-vpet"; readonly version: string }>

const EXACT_SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const isPackageManifest = (value: unknown): value is PackageManifest => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  if (!("name" in value) || !("version" in value)) return false
  const { name, version } = value
  return name === "@sbugallo/opencode-vpet" && typeof version === "string" && EXACT_SEMVER.test(version)
}

const readPackageManifest = async (): Promise<PackageManifest> => {
  const source = await readFile(new URL("../package.json", import.meta.url), "utf8")
  const manifest: unknown = JSON.parse(source)
  if (!isPackageManifest(manifest)) throw new Error("Invalid opencode-vpet package manifest.")
  return manifest
}

const parseArguments = (arguments_: readonly string[]): ParsedArguments => {
  if (arguments_.length === 1 && arguments_[0] === "--help") return { kind: "help" }
  const [command, ...options] = arguments_
  if (command !== "init" && command !== "update") return { kind: "invalid", message: "Expected init or update." }
  if (options.length === 0) return { kind: "command", command, dryRun: false }
  if (options.length === 1 && options[0] === "--dry-run") return { kind: "command", command, dryRun: true }
  return { kind: "invalid", message: "Only --dry-run is supported after a command." }
}

const run = async (): Promise<number> => {
  const parsed = parseArguments(process.argv.slice(2))
  switch (parsed.kind) {
    case "help":
      process.stdout.write(HELP)
      return 0
    case "invalid":
      process.stderr.write(`${parsed.message}\n\n${HELP}`)
      return 2
    case "command": {
      const manifest = await readPackageManifest()
      const packageSpec = `${manifest.name}@${manifest.version}`
      if (parsed.dryRun) {
        process.stdout.write(`opencode plugin ${packageSpec} --global --force\n`)
        return 0
      }
      await installGlobalPlugin(packageSpec)
      process.stdout.write("OpenCode plugin installation completed. Restart OpenCode.\n")
      return 0
    }
  }
}

run()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected CLI failure."
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
