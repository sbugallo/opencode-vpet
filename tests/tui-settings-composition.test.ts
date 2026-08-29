import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender } from "@opentui/solid"
import type { JSX } from "@opentui/solid"

import { createSqliteSidebarSnapshotReader } from "../src/adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import type { SidebarCardInputs } from "../src/application/models/sidebar-card-inputs.ts"
import type { VpetArchiveReader } from "../src/application/ports/vpet-archive.ts"
import { getSidebarCardInputs } from "../src/application/use-cases/get-sidebar-card-inputs.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { loadGlobalVpetSettings } from "../src/config/global-vpet-settings.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { createTui } from "../src/tui.tsx"
import { TuiCompositionHarness } from "./tui-composition-fixture.ts"

const flush = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const event = { on: () => () => undefined }

describe("TUI settings composition", () => {
  test("Given English startup settings When the archive command opens after configuration changes Then its history retains startup localization", async () => {
    const archiveReader: VpetArchiveReader = {
      getArchive: () => ({
        kind: "available",
        partners: [
          {
            partnerId: "partner-1",
            generation: 1,
            createdAt: "2026-08-24T00:00:00.000Z",
            retiredAt: null,
            events: [{ eventId: "event-1", currentNodeId: "4-001", createdAt: "2026-08-24T00:00:00.000Z" }],
          },
        ],
      }),
    }
    const root = await mkdtemp(join(tmpdir(), "opencode-vpet-history-settings-"))
    const configDirectory = join(root, ".config")
    const configPath = join(configDirectory, "opencode-vpet.json")
    const harness = new TuiCompositionHarness()

    try {
      await mkdir(configDirectory)
      await writeFile(configPath, JSON.stringify({ language: "en" }))
      const settings = await loadGlobalVpetSettings({ home: root })
      await harness.startWith(createTui(() => ({ kind: "no_partner" }), settings, { archiveReader }))
      await writeFile(configPath, JSON.stringify({ language: "jp" }))

      harness.invokeCommand("vpet-history")
      const dialog = harness.dialogStack.renders[0]
      if (dialog === undefined) throw new Error("Expected history dialog render")
      const setup = await testRender(() => dialog(), { width: 80, height: 24 })
      await setup.flush()
      const frame = setup.captureCharFrame()

      expect(frame).toContain("4-001 Agunimon")
      expect(frame).not.toContain("4-001 アグニモン")
      setup.renderer.destroy()
    } finally {
      await harness.dispose?.()
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a readonly sidebar query When the TUI starts Then it applies the queried partner and requests a render", async () => {
    const inputs: SidebarCardInputs = {
      kind: "partner",
      node: {
        id: "3-001",
        nameEn: "Agumon",
        nameJp: "Agumon",
        nextEvolutions: [],
        sprite: "agumon",
        stage: 3,
        url: "https://example.test/agumon",
      },
      gauge: 42,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 100,
    }
    let slot: (() => unknown) | undefined
    let dispose: (() => void | Promise<void>) | undefined
    let renderRequests = 0

    const tui = createTui(() => inputs, DEFAULT_VPET_SETTINGS)

    await tui({
      event,
      renderer: {
        requestRender: () => {
          renderRequests += 1
        },
      },
      lifecycle: {
        onDispose: (callback) => {
          dispose = callback
          return () => undefined
        },
      },
      slots: {
        register: (plugin) => {
          slot = plugin.slots.sidebar_content
          return "opencode-vpet"
        },
      },
    })
    await flush()

    expect(renderRequests).toBe(1)
    expect(slot).toBeFunction()
    expect(dispose).toBeFunction()
    await dispose?.()
  })

  test("Given an English startup config When its file changes after initialization Then every poll retains the original sidebar projection", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-vpet-tui-config-"))
    const configPath = join(root, ".config", "opencode-vpet.json")
    const inputs: SidebarCardInputs = {
      kind: "partner",
      node: {
        id: "4-001",
        nameEn: "Gatomon",
        nameJp: "Tailmon",
        nextEvolutions: [],
        sprite: "tailmon",
        stage: 4,
        url: "https://example.test/tailmon",
      },
      gauge: 777,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 777,
    }
    let slot: (() => JSX.Element) | undefined
    let dispose: (() => void | Promise<void>) | undefined
    let loadCalls = 0

    try {
      await mkdir(join(root, ".config"))
      await writeFile(
        configPath,
        JSON.stringify({ language: "en", notifications: false, stageThresholds: { adult: 777 } }),
      )
      const settings = await loadGlobalVpetSettings({ home: root })
      expect(settings.notifications).toBeFalse()
      const tui = createTui(() => {
        loadCalls += 1
        return inputs
      }, settings)

      await tui({
        event,
        renderer: { requestRender: () => undefined },
        lifecycle: {
          onDispose: (callback) => {
            dispose = callback
            return () => undefined
          },
        },
        slots: {
          register: (plugin) => {
            slot = plugin.slots.sidebar_content
            return "opencode-vpet"
          },
        },
      })
      await flush()
      await writeFile(configPath, JSON.stringify({ language: "jp", stageThresholds: { adult: 1 } }))
      await new Promise<void>((resolve) => setTimeout(resolve, 550))

      if (slot === undefined) throw new Error("Expected sidebar slot")
      const setup = await testRender(slot, { width: 80, height: 24 })
      await setup.flush()
      const frame = setup.captureCharFrame()

      expect(frame).toContain("Gatomon")
      expect(frame).toContain("Champion")
      expect(frame).toContain("777/777")
      expect(frame).not.toContain("Tailmon")
      expect(frame).not.toContain("Adult")
      expect(loadCalls).toBeGreaterThanOrEqual(2)
      setup.renderer.destroy()
    } finally {
      await dispose?.()
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    ["missing", async (_configPath: string) => undefined],
    [
      "invalid",
      async (configPath: string) =>
        writeFile(configPath, JSON.stringify({ language: "fr", stageThresholds: { adult: 0 } })),
    ],
  ] as const)(
    "Given a %s startup config When the TUI composes its snapshot Then it renders JP defaults",
    async (_name, prepareConfig) => {
      const root = await mkdtemp(join(tmpdir(), "opencode-vpet-tui-defaults-"))
      const configPath = join(root, ".config", "opencode-vpet.json")
      let dispose: (() => void | Promise<void>) | undefined
      let slot: (() => JSX.Element) | undefined

      try {
        await mkdir(join(root, ".config"))
        await prepareConfig(configPath)
        const settings = await loadGlobalVpetSettings({ home: root })
        expect(settings).toEqual(DEFAULT_VPET_SETTINGS)
        const tui = createTui(
          () => ({
            kind: "partner",
            node: {
              id: "4-001",
              nameEn: "Gatomon",
              nameJp: "Tailmon",
              nextEvolutions: [],
              sprite: "tailmon",
              stage: 4,
              url: "https://example.test/tailmon",
            },
            gauge: 7_500_000,
            isTerminal: false,
            frozen: false,
            isSetOverride: false,
            trainerTotalTokens: 7_500_000,
          }),
          settings,
        )

        await tui({
          event,
          renderer: { requestRender: () => undefined },
          lifecycle: {
            onDispose: (callback) => {
              dispose = callback
              return () => undefined
            },
          },
          slots: {
            register: (plugin) => {
              slot = plugin.slots.sidebar_content
              return "opencode-vpet"
            },
          },
        })
        await flush()

        if (slot === undefined) throw new Error("Expected sidebar slot")
        const setup = await testRender(slot, { width: 80, height: 24 })
        await setup.flush()
        const frame = setup.captureCharFrame()

        expect(frame).toContain("Tailmon")
        expect(frame).toContain("Adult")
        expect(frame).toContain("7,500,000/7,500,000")
        expect(frame).not.toContain("Gatomon")
        expect(frame).not.toContain("Champion")
        setup.renderer.destroy()
      } finally {
        await dispose?.()
        await rm(root, { recursive: true, force: true })
      }
    },
  )

  test("Given a missing database at startup When the independently composed reader and query load Then the TUI renders no partner without creating it", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-vpet-tui-"))
    const databasePath = join(root, "missing", "pet.db")
    let slot: (() => unknown) | undefined
    let dispose: (() => void | Promise<void>) | undefined
    let renderRequests = 0

    try {
      const reader = createSqliteSidebarSnapshotReader({ databasePath })
      const tui = createTui(() => getSidebarCardInputs(reader, DIGIMON_CATALOG), DEFAULT_VPET_SETTINGS)

      await tui({
        event,
        renderer: {
          requestRender: () => {
            renderRequests += 1
          },
        },
        lifecycle: {
          onDispose: (callback) => {
            dispose = callback
            return () => undefined
          },
        },
        slots: {
          register: (plugin) => {
            slot = plugin.slots.sidebar_content
            return "opencode-vpet"
          },
        },
      })
      await flush()

      expect(slot).toBeFunction()
      expect(renderRequests).toBe(1)
      expect(existsSync(databasePath)).toBe(false)
    } finally {
      await dispose?.()
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a pending readonly sidebar query When the TUI disposes Then it does not apply or reschedule the result", async () => {
    let resolveQuery: (() => void) | undefined
    let dispose: (() => void | Promise<void>) | undefined
    let renderRequests = 0

    const tui = createTui(async () => {
      await new Promise<void>((resolve) => {
        resolveQuery = resolve
      })
      return { kind: "no_partner" }
    }, DEFAULT_VPET_SETTINGS)

    await tui({
      event,
      renderer: {
        requestRender: () => {
          renderRequests += 1
        },
      },
      lifecycle: {
        onDispose: (callback) => {
          dispose = callback
          return () => undefined
        },
      },
      slots: { register: () => "opencode-vpet" },
    })
    await dispose?.()
    resolveQuery?.()
    await flush()

    expect(renderRequests).toBe(0)
  })
})
