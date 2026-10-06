import { beforeAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { createTui } from "../../src/tui.tsx"
import { OPENCODE_DEV_ACTIONS } from "../../src/dev/catalog.ts"
import { partnerInputs, settle, TuiCompositionHarness } from "../tui-composition-fixture.ts"

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const DIST_DEV_TOOLS = join(PACKAGE_ROOT, "dist/dev/attach-dev-tools.js")
const DIST_TUI = new URL("../../dist/tui.js", import.meta.url).href

const DEV_COMMAND_IDS = OPENCODE_DEV_ACTIONS.map((action) => action.id)

const withDevEnv = async (run: () => Promise<void>): Promise<void> => {
  const previous = process.env["OPENCODE_DIGITAL_PET_DEV"]
  process.env["OPENCODE_DIGITAL_PET_DEV"] = "1"
  try {
    await run()
  } finally {
    if (previous === undefined) delete process.env["OPENCODE_DIGITAL_PET_DEV"]
    else process.env["OPENCODE_DIGITAL_PET_DEV"] = previous
  }
}

const withoutDevEnv = async (run: () => Promise<void>): Promise<void> => {
  const previous = process.env["OPENCODE_DIGITAL_PET_DEV"]
  delete process.env["OPENCODE_DIGITAL_PET_DEV"]
  try {
    await run()
  } finally {
    if (previous === undefined) delete process.env["OPENCODE_DIGITAL_PET_DEV"]
    else process.env["OPENCODE_DIGITAL_PET_DEV"] = previous
  }
}

const expectDevLayer = (harness: TuiCompositionHarness): void => {
  const devLayer = harness.layers.find((layer) => layer["namespace"] === "opencode-digital-pet-dev")
  expect(devLayer).toBeDefined()
  expect(devLayer?.commands?.map((command) => command["name"])).toEqual(DEV_COMMAND_IDS)
}

describe("opencode-digital-pet dev attach-dev-tools", () => {
  test("Given the dev catalog When inspected Then it exposes five palette commands", () => {
    expect(OPENCODE_DEV_ACTIONS.map((action) => action.id)).toEqual([
      "feed",
      "activity",
      "evolution_reveal",
      "evolution_battle",
      "defeat",
    ])
  })

  test("Given OPENCODE_DIGITAL_PET_DEV When createTui composes Then the dev command layer registers", async () => {
    await withDevEnv(async () => {
      const harness = new TuiCompositionHarness()
      await harness.startWith(createTui(() => partnerInputs("agumon"), DEFAULT_DIGITAL_PET_SETTINGS))
      expectDevLayer(harness)
      await harness.dispose?.()
    })
  })

  test("Given OPENCODE_DIGITAL_PET_DEV When the feed command runs Then it publishes a feed animation", async () => {
    await withDevEnv(async () => {
      const harness = new TuiCompositionHarness()
      await harness.start(() => partnerInputs("agumon"))
      const observedBefore = harness.observed.length
      harness.invokeCommand("feed")
      harness.scheduler.tickVisual()
      expect(harness.observed.length).toBeGreaterThan(observedBefore)
      await harness.dispose?.()
    })
  })

  test("Given no OPENCODE_DIGITAL_PET_DEV When createTui composes Then the dev command layer is omitted", async () => {
    await withoutDevEnv(async () => {
      const harness = new TuiCompositionHarness()
      await harness.startWith(createTui(() => partnerInputs("agumon"), DEFAULT_DIGITAL_PET_SETTINGS))
      expect(harness.layers.some((layer) => layer["namespace"] === "opencode-digital-pet-dev")).toBe(false)
      await harness.dispose?.()
    })
  })
})

describe("opencode-digital-pet dev attach-dev-tools dist", () => {
  beforeAll(() => {
    if (!existsSync(DIST_DEV_TOOLS)) {
      const build = Bun.spawnSync(["bun", "run", "build"], { cwd: PACKAGE_ROOT })
      if (build.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(build.stderr))
      }
    }
  }, 60_000)

  test("Given built dist When the dev attach module is imported Then attachDevTools is exported", async () => {
    const module = await import(new URL("../../dist/dev/attach-dev-tools.js", import.meta.url).href)
    expect(typeof module.attachDevTools).toBe("function")
  })

  test("Given built dist and OPENCODE_DIGITAL_PET_DEV When createTui composes Then the dev command layer registers", async () => {
    await withDevEnv(async () => {
      const { createTui: createBuiltTui } = await import(DIST_TUI)
      const harness = new TuiCompositionHarness()
      await harness.startWith(createBuiltTui(() => partnerInputs("agumon"), DEFAULT_DIGITAL_PET_SETTINGS))
      expectDevLayer(harness)
      await harness.dispose?.()
      await settle()
    })
  })
})
