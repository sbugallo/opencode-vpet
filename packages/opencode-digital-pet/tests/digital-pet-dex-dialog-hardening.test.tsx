/** @jsxImportSource @opentui/solid */
import { describe, expect, test, mock } from "bun:test"
import { testRender } from "@opentui/solid"
import { DigitalPetDexDialog } from "../src/tui/digital-pet-dex-dialog.tsx"
import type { DexViewModel } from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"
import { createMockTheme } from "./digital-pet-dex-dialog-fixture.tsx"

describe("DigitalPetDexDialog hardening", () => {
  test("renders all undiscovered correctly", async () => {
    const onClose = mock()
    const model: DexViewModel = {
      kind: "available",
      rows: [
        { id: "digital-pet-001", stage: "Baby", discovered: false, name: "------" },
        { id: "digital-pet-002", stage: "Child", discovered: false, name: "------" },
      ],
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <DigitalPetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("digital-pet-001")
    expect(frame).not.toContain("Agumon")

    setup.renderer.destroy()
  })

  test("renders bilingual names and long unknown IDs properly", async () => {
    const onClose = mock()
    const model: DexViewModel = {
      kind: "available",
      rows: [
        { id: "digital-pet-special-001", stage: "Mega", discovered: true, name: "Omegamon / WarGreymon" },
        { id: "digital-pet-extremely-long-unknown-id", stage: "Super", discovered: false, name: "------" },
      ],
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <DigitalPetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 50,
      height: 24,
    })
    await setup.flush()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("Omegamon /")

    setup.renderer.destroy()
  })

  test("scrolls the entire unfiltered catalogue", async () => {
    const onClose = mock()
    const rows = Array.from({ length: 50 }).map((_, i) => ({
      id: `digital-pet-${i.toString().padStart(3, "0")}`,
      stage: "Baby",
      discovered: true,
      name: `Mon ${i}`,
    }))

    const model: DexViewModel = {
      kind: "available",
      rows,
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <DigitalPetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 10,
    })
    await setup.flush()

    let frame = setup.captureCharFrame()
    expect(frame).toContain("digital-pet-000")
    expect(frame).not.toContain("digital-pet-049")

    for (let i = 0; i < 30; i++) {
      setup.mockInput.pressArrow("down")
    }
    await setup.flush()

    frame = setup.captureCharFrame()
    expect(frame).not.toContain("digital-pet-000")

    setup.renderer.destroy()
  })
})
