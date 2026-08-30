import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { JSX } from "@opentui/solid"
import { join } from "node:path"

import { MonsterFrame, MONSTER_FRAME_CATALOG } from "../src/data/monster-frame-catalog.ts"
import entryPlugin, { createCommandConfig, plugin } from "../src/index.ts"
import tuiPlugin from "../src/tui.tsx"
import type { MonsterAnimationOutput } from "../src/tui/monster-animation.ts"
import { mirrorMonsterFrame } from "../src/tui/monster-artwork-mirror.ts"
import {
  createPackageFixture,
  fixtureEntryUrl,
  hasFixtureArtifacts,
  removePackageFixture,
  type PackageFixture,
} from "./package-fixture.ts"

const partnerInputs = (sprite: string, stage = 3) => ({
  kind: "partner" as const,
  node: {
    id: "3-001",
    nameEn: "Agumon",
    nameJp: "Agumon",
    nextEvolutions: [],
    sprite,
    stage,
    url: `https://example.test/${sprite}`,
  },
  gauge: 42,
  isTerminal: false,
  trainerTotalTokens: 100,
})

type BuiltSidebarCapture = {
  readonly frame: string
  readonly outputs: readonly MonsterAnimationOutput[]
  readonly subscriptions: readonly string[]
  readonly unsubscribeCalls: number
}

const rightFacingAgumonFrame = (): string[] => {
  const walkFrame = MONSTER_FRAME_CATALOG.get("agumon", "walk_2")
  if (walkFrame === undefined) throw new Error("Expected agumon/walk_2 artwork")
  const mirrored = mirrorMonsterFrame(walkFrame)
  if (mirrored.kind === "invalid") throw mirrored.error
  return mirrored.frame.content.split("\n")
}

const firstRightFacingAnimation = (capture: BuiltSidebarCapture): string | undefined => {
  const frame = capture.outputs.find(
    (output) => output.kind === "walking" && output.facing === "right" && output.offset === -32,
  )?.result
  return frame?.kind === "frame" ? frame.frame.content : undefined
}

const renderBuiltSidebar = async (
  fixture: PackageFixture,
  loadInputs: () => ReturnType<typeof partnerInputs> | { readonly kind: "no_partner" },
  visualTicks = 1,
  refreshAfterMount?: () => void,
): Promise<BuiltSidebarCapture> => {
  const builtTui = await import(`${fixtureEntryUrl(fixture, "tui.js")}?${crypto.randomUUID()}`)
  let poll: (() => void) | undefined
  let visualTick: (() => void) | undefined
  let slot: (() => JSX.Element) | undefined
  let dispose: (() => void) | undefined
  const subscriptions: string[] = []
  const outputs: MonsterAnimationOutput[] = []
  let unsubscribeCalls = 0
  let frame = ""

  await builtTui.createTui(
    loadInputs,
    {
      language: "jp",
      notifications: true,
      stageLabels: {
        en: {
          egg: "DigiEgg",
          babyI: "In Training I",
          babyII: "In Training II",
          child: "Rookie",
          adult: "Champion",
          perfect: "Ultimate",
          ultimate: "Mega",
          superUltimate: "Ultra",
        },
        jp: {
          egg: "Digitama",
          babyI: "Baby I",
          babyII: "Baby II",
          child: "Child",
          adult: "Adult",
          perfect: "Perfect",
          ultimate: "Ultimate",
          superUltimate: "SuperUltimate",
        },
      },
      stageThresholds: {
        egg: 1_000,
        babyI: 5_000,
        babyII: 25_000,
        child: 100_000,
        adult: 500_000,
        perfect: 2_500_000,
        ultimate: 5_000_000,
        superUltimate: 10_000_000,
      },
    },
    {
      scheduleVisualInterval: (callback: () => void) => {
        visualTick = callback
        return () => undefined
      },
      schedulePollTimeout: (callback: () => void) => {
        poll = callback
        return () => undefined
      },
      onAnimation: (output: MonsterAnimationOutput) => {
        outputs.push(output)
      },
    },
  )({
    event: {
      on: (type: string) => {
        subscriptions.push(type)
        return () => {
          unsubscribeCalls += 1
        }
      },
    },
    renderer: { requestRender: () => undefined },
    lifecycle: {
      onDispose: (callback: () => void) => {
        dispose = callback
        return () => undefined
      },
    },
    slots: {
      register: (registered: { readonly slots: { readonly sidebar_content: () => JSX.Element } }) => {
        slot = registered.slots.sidebar_content
        return "opencode-vpet"
      },
    },
  })

  try {
    if (slot === undefined) throw new Error("Expected built TUI to register a sidebar slot")
    const setup = await testRender(slot, { width: 81, height: 24 })
    await setup.flush()
    setup.renderer.resize(80, 24)
    await setup.flush()
    await Promise.resolve()
    await Promise.resolve()
    refreshAfterMount?.()
    poll?.()
    await Promise.resolve()
    await Promise.resolve()
    for (let tick = 0; tick < visualTicks; tick += 1) visualTick?.()
    await setup.renderOnce()
    frame = setup.captureCharFrame()
    setup.renderer.destroy()
  } finally {
    dispose?.()
  }
  return { frame, outputs, subscriptions, unsubscribeCalls }
}

describe("lightweight package boundary", () => {
  let fixture: PackageFixture

  beforeAll(async () => {
    fixture = await createPackageFixture()
  })

  afterAll(async () => {
    await removePackageFixture(fixture)
  })

  test("Given the core entrypoint When OpenCode configures it Then it registers all VPet commands", async () => {
    expect(entryPlugin).toEqual({ id: "opencode-vpet", server: plugin })
    expect(createCommandConfig()).toEqual({
      "vpet-spawn": {
        template: "Spawn a new virtual pet.",
      },
      "vpet-freeze": {
        template: "Freeze virtual pet progression.",
      },
      "vpet-unfreeze": {
        template: "Unfreeze virtual pet progression.",
      },
      "vpet-set": {
        template: "Set the virtual pet to a Digimon ID: $ARGUMENTS",
      },
    })
  })

  test("Given the built core entrypoint When OpenCode loads it Then it exposes a callable server", async () => {
    const builtModule = await import(fixtureEntryUrl(fixture, "index.js"))
    const builtEntry = builtModule.default

    expect(builtEntry.id).toBe("opencode-vpet")
    expect(builtEntry.server).toBeFunction()
    expect(builtModule.createCommandConfig()).toEqual(createCommandConfig())
  })

  test("Given an isolated built TUI When a consumer ticks Digitama, walking, and unavailable partners Then it observes activity subscriptions and renders the private bundled behavior", async () => {
    const digitama = await renderBuiltSidebar(fixture, () => partnerInputs("egg", 0))
    const unavailable = await renderBuiltSidebar(fixture, () => partnerInputs("unknown-sprite"))
    const empty = await renderBuiltSidebar(fixture, () => partnerInputs(""))
    const noPartner = await renderBuiltSidebar(fixture, () => ({ kind: "no_partner" }))
    const originalRandom = Math.random
    let walking: BuiltSidebarCapture
    try {
      Math.random = () => 0
      walking = await renderBuiltSidebar(fixture, () => partnerInputs("agumon"), 58)
    } finally {
      Math.random = originalRandom
    }

    expect(digitama.frame).toContain("                                    ▄▄▀▀▀▀▄▄")
    expect(digitama.subscriptions).toEqual(["message.updated", "message.part.updated", "session.status"])
    expect(digitama.unsubscribeCalls).toBe(3)
    const rightFacingFrame = firstRightFacingAnimation(walking)
    if (rightFacingFrame === undefined) throw new Error("Expected built right-facing animation frame")
    const mirrored = mirrorMonsterFrame(new MonsterFrame(rightFacingFrame))
    expect(mirrored.kind).toBe("mirrored")
    if (mirrored.kind === "mirrored") expect(mirrored.frame.content.split("\n")).toEqual(rightFacingAgumonFrame())
    expect(unavailable.frame).toContain("Artwork unavailable: unknown-sprite")
    expect(empty.frame).toContain("Artwork unavailable: (empty)")
    expect(noPartner.frame).toContain("No active partner")
    expect(await hasFixtureArtifacts(fixture)).toBe(true)
  })

  test("Given a packed isolated package When an external consumer imports only public roots Then all command configs survive and private modules remain unavailable", async () => {
    expect(fixture.archiveMembers).toEqual(
      expect.arrayContaining([
        "package/package.json",
        "package/README.md",
        "package/LICENSE",
        "package/dist/index.js",
        "package/dist/index.d.ts",
        "package/dist/tui.js",
        "package/dist/tui.d.ts",
        "package/dist/cli.js",
      ]),
    )
    expect(fixture.archiveMembers.some((member) => /\.(?:txt|png|npy)$/.test(member))).toBe(false)
    expect(
      fixture.archiveMembers.some(
        (member) => member.startsWith("package/src/") || member.startsWith("package/assets/"),
      ),
    ).toBe(false)

    const consumerScript = join(fixture.consumerDirectory, "verify-animation-package.mjs")
    await Bun.write(
      consumerScript,
      `
import entryPlugin, { createCommandConfig } from "opencode-vpet"
import { testRender } from "@opentui/solid"

const settings = { language: "jp", stageLabels: { en: { egg: "DigiEgg", babyI: "Baby I", babyII: "Baby II", child: "Child", adult: "Adult", perfect: "Perfect", ultimate: "Ultimate", superUltimate: "SuperUltimate" }, jp: { egg: "Digitama", babyI: "Baby I", babyII: "Baby II", child: "Child", adult: "Adult", perfect: "Perfect", ultimate: "Ultimate", superUltimate: "SuperUltimate" } }, stageThresholds: { egg: 1000, babyI: 5000, babyII: 25000, child: 100000, adult: 500000, perfect: 2500000, ultimate: 5000000, superUltimate: 10000000 } }
const originalRandom = Math.random
try {
Math.random = () => 0
const { default: tuiPlugin, createTui } = await import("opencode-vpet/tui")
let registeredLayer; let dialogOpened = false; const partner = (sprite, stage) => ({ kind: "partner", node: { id: "3-001", nameEn: "Agumon", nameJp: "Agumon", nextEvolutions: [], sprite, stage, url: "https://example.test/partner" }, gauge: 42, isTerminal: false, trainerTotalTokens: 100 })
const render = async (loadInputs, ticks, refreshAfterMount) => {
  let tick; let poll
  let slot
  let dispose
  let renderer
  const subscriptions = []
  const outputs = []
  const fakeArchiveReader = { async *readVpetArchiveEvents() { yield { type: "vpet_spawned", timestamp: Date.now() } } }; await createTui(loadInputs, settings, { scheduleVisualInterval: (callback) => { tick = callback; return () => undefined }, schedulePollTimeout: (callback) => { poll = callback; return () => undefined }, onAnimation: (output) => outputs.push(output), archiveReader: fakeArchiveReader })({ event: { on: (type) => { subscriptions.push(type); return () => undefined } }, renderer: { requestRender: () => renderer?.requestRender() }, lifecycle: { onDispose: (callback) => { dispose = callback; return () => undefined } }, slots: { register: (registered) => { slot = registered.slots.sidebar_content; return "opencode-vpet" } }, keymap: { registerLayer: (layer) => { registeredLayer = layer; return () => undefined } }, ui: { dialog: { replace: (el) => { dialogOpened = true; return undefined }, clear: () => undefined, setSize: () => undefined }, Dialog: (props) => props.children }, theme: { spacing: { 1: 1 }, colors: { fg: "white" } } })
  try { const setup = await testRender(slot, { width: 81, height: 24 }); renderer = setup.renderer; await setup.flush(); setup.renderer.resize(80, 24); await setup.flush(); await Promise.resolve(); await Promise.resolve(); refreshAfterMount?.(); poll?.(); await Promise.resolve(); await Promise.resolve(); for (let index = 0; index < ticks; index += 1) tick(); await setup.renderOnce(); const frame = setup.captureCharFrame(); setup.renderer.destroy(); if (registeredLayer) { const dexCmd = registeredLayer.commands.find(c => c.name === "vpet.dex"); if (dexCmd) dexCmd.run(); } return { frame, subscriptions, outputs } } finally { dispose() }
}
if (entryPlugin.id !== "opencode-vpet" || typeof entryPlugin.server !== "function") throw new Error("Core export failed")
if (tuiPlugin.id !== "opencode-vpet" || typeof tuiPlugin.tui !== "function") throw new Error("TUI export failed")
const privateTuiRejected = !(await import("opencode-vpet/tui/monster-animation").then(() => true, () => false))
const privateCommandRejected = !(await import("opencode-vpet/commands/vpet-freeze").then(() => true, () => false))
const commandConfigs = Object.keys(createCommandConfig()).sort()
if (!privateTuiRejected) throw new Error("Private TUI module exported")
 if (!privateCommandRejected) throw new Error("Private command module exported")
if (commandConfigs.join(",") !== "vpet-freeze,vpet-set,vpet-spawn,vpet-unfreeze") throw new Error("Packed command configuration missing")
const walking = await render(() => partner("agumon", 3), 58)
if (!walking.outputs.some((output) => output.kind === "walking" && output.facing === "right" && output.offset === -32)) throw new Error("Right-facing animation transition failed")
if (walking.subscriptions.join(",") !== "message.updated,message.part.updated,session.status") throw new Error("Activity subscriptions missing")
let retainedInputs = partner("egg", 0)
const retained = await render(() => retainedInputs, 6, () => { retainedInputs = partner("agumon", 3) })
const retainedMovement = retained.outputs.some((output) => output.kind === "walking" && output.offset === -1 && output.facing === "left")
const retainedAction = retained.outputs.some((output) => output.kind === "action" && output.offset === -5 && output.facing === "left")
if (!retainedMovement) throw new Error("Installed package retained-width movement failed")
if (!retainedAction) throw new Error("Installed package retained-width action failed")
console.log(JSON.stringify({ commandConfigs, privateCommandRejected, privateTuiRejected, rightFacing: walking.outputs.find((output) => output.kind === "walking" && output.facing === "right" && output.offset === -32), retainedMovement, retainedAction, layerCommands: registeredLayer ? registeredLayer.commands.map(c => c.name) : [], dialogOpened }))
} finally { Math.random = originalRandom }
`,
    )
    const result = Bun.spawnSync(["bun", "--cwd", fixture.consumerDirectory, consumerScript], {
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0)
    expect(new TextDecoder().decode(result.stderr)).toBe("")
    expect(new TextDecoder().decode(result.stdout)).toContain('"facing":"right"')
    expect(new TextDecoder().decode(result.stdout)).toContain(
      '"commandConfigs":["vpet-freeze","vpet-set","vpet-spawn","vpet-unfreeze"]',
    )
    expect(new TextDecoder().decode(result.stdout)).toContain('"privateCommandRejected":true')
    expect(new TextDecoder().decode(result.stdout)).toContain('"privateTuiRejected":true')
    expect(new TextDecoder().decode(result.stdout)).toContain('"retainedMovement":true')
    expect(new TextDecoder().decode(result.stdout)).toContain('"retainedAction":true')
    expect(new TextDecoder().decode(result.stdout)).toContain('"layerCommands":["vpet.dex","vpet.history"]')
    expect(new TextDecoder().decode(result.stdout)).toContain('"dialogOpened":true')
  })

  test("Given the packed npm bin When Node runs help and dry-run Then the CLI is Node-compatible and does not write configuration", async () => {
    const cliPath = join(fixture.consumerDirectory, "node_modules", "opencode-vpet", "dist", "cli.js")
    const helpResult = Bun.spawnSync([process.execPath, cliPath, "--help"], { stdout: "pipe", stderr: "pipe" })
    const configDirectory = join(fixture.root, "cli-config")
    const dryRunResult = Bun.spawnSync([process.execPath, cliPath, "init", "--dry-run"], {
      cwd: fixture.consumerDirectory,
      env: { ...process.env, OPENCODE_CONFIG_DIR: configDirectory },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(helpResult.exitCode, new TextDecoder().decode(helpResult.stderr)).toBe(0)
    expect(new TextDecoder().decode(helpResult.stdout)).toContain("Usage: opencode-vpet")
    expect(dryRunResult.exitCode, new TextDecoder().decode(dryRunResult.stderr)).toBe(0)
    expect(new TextDecoder().decode(dryRunResult.stdout)).toContain("Would update")
    expect(await Bun.file(join(configDirectory, "opencode.json")).exists()).toBe(false)
    expect(await Bun.file(join(configDirectory, "tui.json")).exists()).toBe(false)
    const initResult = Bun.spawnSync([process.execPath, cliPath, "init"], {
      cwd: fixture.consumerDirectory,
      env: { ...process.env, OPENCODE_CONFIG_DIR: configDirectory },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(initResult.exitCode, new TextDecoder().decode(initResult.stderr)).toBe(0)
    expect(new TextDecoder().decode(initResult.stdout)).toContain("Restart OpenCode.")
    expect(await Bun.file(join(configDirectory, "opencode.json")).text()).toContain('"@sbugallo/opencode-vpet"')
    expect(await Bun.file(join(configDirectory, "tui.json")).text()).toContain('"@sbugallo/opencode-vpet"')
    const updateResult = Bun.spawnSync([process.execPath, cliPath, "update"], {
      cwd: fixture.consumerDirectory,
      env: { ...process.env, OPENCODE_CONFIG_DIR: configDirectory },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(updateResult.exitCode, new TextDecoder().decode(updateResult.stderr)).toBe(0)
    expect(new TextDecoder().decode(updateResult.stdout)).toContain("already current")
    const invalidResult = Bun.spawnSync([process.execPath, cliPath, "unknown"], { stdout: "pipe", stderr: "pipe" })
    expect(invalidResult.exitCode).toBe(2)
    expect(new TextDecoder().decode(invalidResult.stderr)).toContain("Expected init or update.")
  })

  test("Given published package metadata When a registry reads it Then it describes all four VPet commands", async () => {
    const manifest = await Bun.file(new URL("../package.json", import.meta.url)).text()

    expect(manifest).toContain(
      '"description": "An OpenCode virtual-pet plugin with /vpet-spawn, /vpet-freeze, /vpet-unfreeze, /vpet-set, /vpet-dex, and /vpet-history commands."',
    )
  })

  test("Given the TUI entrypoint When OpenCode loads it Then it is the compact plugin module", () => {
    expect(tuiPlugin).toMatchObject({ id: "opencode-vpet" })
    expect(tuiPlugin.tui).toBeFunction()
  })
})
