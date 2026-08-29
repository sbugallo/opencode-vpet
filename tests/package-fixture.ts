import { cp, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url))
const REQUIRED_ARTIFACTS = ["index.js", "index.d.ts", "tui.js", "tui.d.ts", "cli.js"] as const
const EXCLUDED_COPY_DIRECTORIES = new Set([".git", ".omo", "dist", "node_modules"])

export type PackageFixture = {
  readonly root: string
  readonly packageDirectory: string
  readonly consumerDirectory: string
  readonly archiveMembers: readonly string[]
}

type Command = {
  readonly args: string[]
  readonly cwd: string
}

const runCommand = (command: Command): string => {
  const result = Bun.spawnSync(command.args, {
    cwd: command.cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    throw new Error(`${command.args.join(" ")} failed:\n${new TextDecoder().decode(result.stderr)}`)
  }
  return new TextDecoder().decode(result.stdout)
}

const copyPackage = async (root: string): Promise<string> => {
  const packageDirectory = join(root, "package")
  await cp(PROJECT_ROOT, packageDirectory, {
    recursive: true,
    filter: (source) => !EXCLUDED_COPY_DIRECTORIES.has(basename(source)),
  })
  await symlink(join(PROJECT_ROOT, "node_modules"), join(packageDirectory, "node_modules"), "dir")
  return packageDirectory
}

const packPackage = async (
  packageDirectory: string,
): Promise<{ readonly archivePath: string; readonly archiveMembers: readonly string[] }> => {
  const archiveDirectory = join(packageDirectory, "archive")
  await mkdir(archiveDirectory)
  runCommand({ args: ["bun", "pm", "pack", "--destination", archiveDirectory], cwd: packageDirectory })
  const [archiveName] = await readdir(archiveDirectory)
  if (archiveName === undefined) throw new Error("Expected Bun to create a package archive.")
  const archivePath = join(archiveDirectory, archiveName)
  const archiveMembers = runCommand({ args: ["tar", "-tzf", archivePath], cwd: packageDirectory })
    .trim()
    .split("\n")
  return { archivePath, archiveMembers }
}

const linkConsumerDependencies = async (consumerDirectory: string): Promise<void> => {
  const dependencies = [
    "@opencode-ai/plugin",
    "@opencode-ai/sdk",
    "@opentui/core",
    "@opentui/keymap",
    "@opentui/solid",
    "jsonc-parser",
    "solid-js",
  ] as const
  for (const dependency of dependencies) {
    const destination = join(consumerDirectory, "node_modules", dependency)
    await mkdir(join(destination, ".."), { recursive: true })
    await symlink(join(PROJECT_ROOT, "node_modules", dependency), destination, "dir")
  }
}

const createConsumer = async (root: string, archivePath: string): Promise<string> => {
  const consumerDirectory = join(root, "consumer")
  const nodeModulesDirectory = join(consumerDirectory, "node_modules")
  await mkdir(nodeModulesDirectory, { recursive: true })
  runCommand({ args: ["tar", "-xzf", archivePath, "-C", nodeModulesDirectory], cwd: consumerDirectory })
  await rename(join(nodeModulesDirectory, "package"), join(nodeModulesDirectory, "opencode-vpet"))
  await linkConsumerDependencies(consumerDirectory)
  return consumerDirectory
}

export const createPackageFixture = async (): Promise<PackageFixture> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-vpet-package-"))
  try {
    const packageDirectory = await copyPackage(root)
    runCommand({ args: ["bun", "run", "build"], cwd: packageDirectory })
    const packed = await packPackage(packageDirectory)
    const consumerDirectory = await createConsumer(root, packed.archivePath)
    return { root, packageDirectory, consumerDirectory, archiveMembers: packed.archiveMembers }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

export const removePackageFixture = async (fixture: PackageFixture): Promise<void> => {
  await rm(fixture.root, { recursive: true, force: true })
}

export const fixtureEntryUrl = (fixture: PackageFixture, entry: (typeof REQUIRED_ARTIFACTS)[number]): string =>
  new URL(`./dist/${entry}`, `file://${fixture.packageDirectory}/`).href

export const hasFixtureArtifacts = async (fixture: PackageFixture): Promise<boolean> =>
  (
    await Promise.all(
      REQUIRED_ARTIFACTS.map((artifact) => Bun.file(join(fixture.packageDirectory, "dist", artifact)).exists()),
    )
  ).every(Boolean)

export const verifyPackedConsumer = async (fixture: PackageFixture): Promise<void> => {
  const scriptPath = join(fixture.consumerDirectory, "verify-package.mjs")
  await writeFile(
    scriptPath,
    `
import entryPlugin from "opencode-vpet"
import tuiPlugin, { createTui } from "opencode-vpet/tui"
import { testRender } from "@opentui/solid"

const settings = {
  language: "jp",
  notifications: true,
  stageLabels: {
    en: { egg: "DigiEgg", babyI: "In Training I", babyII: "In Training II", child: "Rookie", adult: "Champion", perfect: "Ultimate", ultimate: "Mega", superUltimate: "Ultra" },
    jp: { egg: "Digitama", babyI: "Baby I", babyII: "Baby II", child: "Child", adult: "Adult", perfect: "Perfect", ultimate: "Ultimate", superUltimate: "SuperUltimate" },
  },
  stageThresholds: { egg: 1000, babyI: 5000, babyII: 25000, child: 100000, adult: 500000, perfect: 2500000, ultimate: 5000000, superUltimate: 10000000 },
}

const partner = (sprite) => ({ kind: "partner", node: { id: "3-001", nameEn: "Agumon", nameJp: "Agumon", nextEvolutions: [], sprite, stage: 3, url: "https://example.test/agumon" }, gauge: 42, isTerminal: false, trainerTotalTokens: 100 })

const render = async (inputs) => {
  let tick
  let slot
  let dispose
  await createTui(() => inputs, settings, {
    scheduleVisualInterval: (callback) => { tick = callback; return () => undefined },
    schedulePollTimeout: () => () => undefined,
  })({
    renderer: { requestRender: () => undefined },
    lifecycle: { onDispose: (callback) => { dispose = callback; return () => undefined } },
    slots: { register: (registered) => { slot = registered.slots.sidebar_content; return "opencode-vpet" } },
  })
  try {
    tick()
    const setup = await testRender(slot, { width: 80, height: 24 })
    await setup.flush()
    const frame = setup.captureCharFrame()
    setup.renderer.destroy()
    return frame
  } finally {
    dispose()
  }
}

if (entryPlugin.id !== "opencode-vpet" || typeof entryPlugin.server !== "function") throw new Error("Core export failed")
if (tuiPlugin.id !== "opencode-vpet" || typeof tuiPlugin.tui !== "function") throw new Error("TUI export failed")
const [known, unavailable, empty] = await Promise.all([render(partner("agumon")), render(partner("unknown-sprite")), render(partner(""))])
if (!known.includes("▄▀▀▀▀▀▄")) throw new Error("Known artwork fallback failed")
if (!unavailable.includes("Artwork unavailable: unknown-sprite")) throw new Error("Unknown artwork fallback failed")
if (!empty.includes("Artwork unavailable: (empty)")) throw new Error("Empty artwork fallback failed")
`,
  )
  runCommand({ args: ["bun", "--cwd", fixture.consumerDirectory, scriptPath], cwd: fixture.consumerDirectory })
}
