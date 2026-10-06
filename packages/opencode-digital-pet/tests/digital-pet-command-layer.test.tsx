/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"

import type { DigitalPetArchiveReader } from "@jcendal/digital-pet-core/application/ports/digital-pet-archive.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { createTui } from "../src/tui.tsx"
import { partnerInputs, settle, TuiCompositionHarness } from "./tui-composition-fixture.ts"

describe("Digital Pet command dialog ownership", () => {
  test.each([
    ["Dex", "digital-pet-dex"],
    ["history", "digital-pet-history"],
  ])(
    "Given the %s command When Escape and the host close callback run Then one host modal is replaced and cleared once",
    async (_label, command) => {
      const archiveReader: DigitalPetArchiveReader = {
        getArchive: () => ({ kind: "empty" }),
      }
      const harness = new TuiCompositionHarness()
      await harness.startWith(createTui(() => partnerInputs("agumon"), DEFAULT_DIGITAL_PET_SETTINGS, { archiveReader }))

      harness.invokeCommand(command)

      expect(harness.dialogStack.replaceCount).toBe(1)
      expect(harness.dialogStack.sizes).toEqual(["medium"])
      const render = harness.dialogStack.renders[0]
      if (render === undefined) throw new Error("Expected Digital Pet dialog body")
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
