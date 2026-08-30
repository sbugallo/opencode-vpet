import { describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { runCommand } from "../src/cli/install.ts"

const PROJECT_ROOT = new URL("../", import.meta.url)

type FakeOpenCode = Readonly<{
  readonly binDirectory: string
  readonly callsPath: string
}>

const createRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "opencode-vpet-cli-"))

const createFakeOpenCode = async (root: string): Promise<FakeOpenCode> => {
  const binDirectory = join(root, "bin")
  const callsPath = join(root, "opencode-calls.jsonl")
  const executablePath = join(binDirectory, "opencode")
  await mkdir(binDirectory)
  await writeFile(
    executablePath,
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs")
appendFileSync(process.env.OPENCODE_FAKE_CALLS, JSON.stringify(process.argv.slice(2)) + "\\n")
process.exit(Number(process.env.OPENCODE_FAKE_EXIT ?? "0"))
`,
  )
  await chmod(executablePath, 0o755)
  return { binDirectory, callsPath }
}

const runCli = (arguments_: readonly string[], root: string, fake: FakeOpenCode, exitCode = 0) =>
  Bun.spawnSync(["bun", "src/cli.ts", ...arguments_], {
    cwd: new URL(".", PROJECT_ROOT).pathname,
    env: {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: join(root, "xdg"),
      OPENCODE_CONFIG_DIR: join(root, "opencode"),
      OPENCODE_FAKE_CALLS: fake.callsPath,
      OPENCODE_FAKE_EXIT: String(exitCode),
      PATH: `${fake.binDirectory}:${process.env.PATH ?? ""}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  })

const readCalls = async (callsPath: string): Promise<readonly (readonly string[])[]> => {
  if (!(await Bun.file(callsPath).exists())) return []
  return (await readFile(callsPath, "utf8"))
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line))
}

describe("OpenCode CLI installer", () => {
  test("Given a fake OpenCode executable When init and update run Then each delegates the installed exact package version through argv", async () => {
    const root = await createRoot()
    try {
      const fake = await createFakeOpenCode(root)
      const manifest = JSON.parse(await Bun.file(new URL("../package.json", import.meta.url)).text())
      const expected = ["plugin", `@sbugallo/opencode-vpet@${manifest.version}`, "--global", "--force"]

      const init = runCli(["init"], root, fake)
      const update = runCli(["update"], root, fake)

      expect(init.exitCode, new TextDecoder().decode(init.stderr)).toBe(0)
      expect(update.exitCode, new TextDecoder().decode(update.stderr)).toBe(0)
      expect(await readCalls(fake.callsPath)).toEqual([expected, expected])
      expect(await Bun.file(join(root, "opencode", "opencode.json")).exists()).toBe(false)
      expect(await Bun.file(join(root, "opencode", "tui.json")).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a fake OpenCode executable When help, invalid input, and dry-run run Then none invoke it or write OpenCode configuration", async () => {
    const root = await createRoot()
    try {
      const fake = await createFakeOpenCode(root)
      const help = runCli(["--help"], root, fake)
      const invalid = runCli(["unknown"], root, fake)
      const initDryRun = runCli(["init", "--dry-run"], root, fake)
      const updateDryRun = runCli(["update", "--dry-run"], root, fake)
      const manifest = JSON.parse(await Bun.file(new URL("../package.json", import.meta.url)).text())
      const plannedCommand = `opencode plugin @sbugallo/opencode-vpet@${manifest.version} --global --force\n`

      expect(help.exitCode, new TextDecoder().decode(help.stderr)).toBe(0)
      expect(invalid.exitCode).toBe(2)
      expect(initDryRun.exitCode, new TextDecoder().decode(initDryRun.stderr)).toBe(0)
      expect(updateDryRun.exitCode, new TextDecoder().decode(updateDryRun.stderr)).toBe(0)
      expect(new TextDecoder().decode(initDryRun.stdout)).toBe(plannedCommand)
      expect(new TextDecoder().decode(updateDryRun.stdout)).toBe(plannedCommand)
      expect(await readCalls(fake.callsPath)).toEqual([])
      expect(await Bun.file(join(root, "opencode", "opencode.json")).exists()).toBe(false)
      expect(await Bun.file(join(root, "opencode", "tui.json")).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a failing fake OpenCode executable When init runs Then the CLI reports a native installer failure", async () => {
    const root = await createRoot()
    try {
      const fake = await createFakeOpenCode(root)

      const result = runCli(["init"], root, fake, 7)

      expect(result.exitCode).toBe(1)
      expect(await readCalls(fake.callsPath)).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given an unavailable executable When the subprocess boundary runs it Then it propagates the start error", async () => {
    await expect(runCommand(`missing-opencode-${crypto.randomUUID()}`, [])).rejects.toThrow("not found")
  })
})
