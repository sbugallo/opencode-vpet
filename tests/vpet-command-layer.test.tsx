/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"

import type { VpetArchiveReader } from "../src/application/ports/vpet-archive.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { createTui } from "../src/tui.tsx"
import { partnerInputs, settle, TuiCompositionHarness } from "./tui-composition-fixture.ts"

describe("VPet command dialog ownership", () => {
  test.each([
    ["Dex", "vpet-dex"],
    ["history", "vpet-history"],
  ])(
    "Given the %s command When Escape and the host close callback run Then one host modal is replaced and cleared once",
    async (_label, command) => {
      const archiveReader: VpetArchiveReader = {
        getArchive: () => ({ kind: "empty" }),
      }
      const harness = new TuiCompositionHarness()
      await harness.startWith(createTui(() => partnerInputs("agumon"), DEFAULT_VPET_SETTINGS, { archiveReader }))

      harness.invokeCommand(command)

      expect(harness.dialogStack.replaceCount).toBe(1)
      expect(harness.dialogStack.sizes).toEqual(["medium"])
      const render = harness.dialogStack.renders[0]
      if (render === undefined) throw new Error("Expected VPet dialog body")
      const setup = await testRender(render, { width: 60, height: 20 })
      await setup.flush()
      expect(harness.dialogComponentCalls).toBe(0)
      setup.mockInput.pressEscape()
      await settle()
      const hostClose = harness.dialogStack.closeCallbacks[0]
      if (hostClose === undefined) throw new Error("Expected host close callback")
      hostClose()

      expect(harness.dialogStack.clearCount).toBe(1)
      setup.renderer.destroy()
      await harness.dispose?.()
    },
  )
})
