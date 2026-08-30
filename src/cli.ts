#!/usr/bin/env node
import { normalizeOpenCodeConfigs } from "./cli/config.ts"

const HELP = `Usage: opencode-vpet <init|update> [--dry-run]

Commands:
  init       Register @sbugallo/opencode-vpet in global OpenCode server and TUI configs.
  update     Normalize the same registrations after updating the package.

Options:
  --dry-run  Show which global config files would change without writing them.
  --help      Show this help text.
`

type Command = "init" | "update"

type ParsedArguments =
  | Readonly<{ readonly kind: "help" }>
  | Readonly<{ readonly kind: "command"; readonly command: Command; readonly dryRun: boolean }>
  | Readonly<{ readonly kind: "invalid"; readonly message: string }>

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
      const result = await normalizeOpenCodeConfigs({ dryRun: parsed.dryRun })
      const action = parsed.dryRun ? "Would update" : "Updated"
      if (result.changedPaths.length === 0)
        process.stdout.write("OpenCode configuration is already current. Restart OpenCode.\n")
      else process.stdout.write(`${action} ${result.changedPaths.join(", ")}. Restart OpenCode.\n`)
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
