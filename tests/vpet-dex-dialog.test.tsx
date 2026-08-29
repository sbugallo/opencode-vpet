/** @jsxImportSource @opentui/solid */
import { describe, expect, test, mock } from "bun:test"
import { ScrollBoxRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { VpetDexDialog } from "../src/tui/vpet-dex-dialog.tsx"
import type { DexViewModel } from "../src/tui/dex-view-model.ts"
import { createMockTheme, createTrackedDialogApi } from "./vpet-dex-dialog-fixture.tsx"

describe("VpetDexDialog", () => {
  test("renders empty state without invoking a nested Dialog", async () => {
    const onClose = mock()
    const model: DexViewModel = { kind: "empty" }
    const { theme, Dialog } = createTrackedDialogApi()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("No data available")
    expect(Dialog).toHaveBeenCalledTimes(0)
    setup.renderer.destroy()
  })

  test("renders unavailable state", async () => {
    const onClose = mock()
    const model: DexViewModel = { kind: "unavailable", message: "Cannot load" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("Cannot load")
    setup.renderer.destroy()
  })

  test("Given a catalogue longer than its viewport When arrow navigation runs Then it scrolls one or ten catalogue rows through the native scrollbox", async () => {
    const onClose = mock()
    const model: DexViewModel = {
      kind: "available",
      rows: Array.from({ length: 50 }, (_, index) => ({
        id: `vpet-${index.toString().padStart(3, "0")}`,
        stage: "Baby",
        discovered: true,
        name: `Mon ${index}`,
      })),
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 10,
    })
    await setup.flush()

    const renderable = setup.renderer.root.findDescendantById("vpet-dex-scrollbox")
    if (!(renderable instanceof ScrollBoxRenderable)) throw new Error("Expected native Dex scrollbox")

    expect(renderable.primaryAxis).toBe("row")
    expect(renderable.verticalScrollBar.x).toBe(renderable.viewport.x + renderable.viewport.width)
    expect(renderable.verticalScrollBar.y).toBe(renderable.viewport.y)
    expect(renderable.verticalScrollBar.height).toBe(renderable.viewport.height)

    setup.mockInput.pressArrow("down")
    await setup.flush()
    expect(renderable.scrollTop).toBe(1)

    setup.mockInput.pressArrow("right")
    await setup.flush()
    expect(renderable.scrollTop).toBe(11)

    setup.mockInput.pressArrow("left")
    await setup.flush()
    expect(renderable.scrollTop).toBe(1)

    setup.mockInput.pressArrow("up")
    await setup.flush()
    expect(renderable.scrollTop).toBe(0)

    const frame = setup.captureCharFrame()
    expect(frame).toContain("VPet Dex")
    expect(frame).toContain("↑↓: 1 item · ←→: 10 items · Esc: Close")
    expect(frame).not.toContain("Search")
    expect(frame).not.toMatch(/[╭╮╰╯]/)

    setup.renderer.destroy()
  })

  test("invokes onClose when Escape is pressed", async () => {
    let resolveEscape: () => void
    const escapePromise = new Promise<void>((resolve) => {
      resolveEscape = resolve
    })
    const onClose = mock(() => {
      resolveEscape()
    })
    const model: DexViewModel = {
      kind: "available",
      rows: [{ id: "vpet-001", stage: "Baby", discovered: true, name: "Botamon" }],
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()

    setup.mockInput.pressEscape()
    await escapePromise

    expect(onClose).toHaveBeenCalledTimes(1)
    setup.renderer.destroy()
  })

  test("wraps content at narrow widths", async () => {
    const onClose = mock()
    const model: DexViewModel = {
      kind: "available",
      rows: [{ id: "vpet-001", stage: "Baby", discovered: true, name: "Very Long Name Indeed" }],
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 25,
      height: 24,
    })
    await setup.flush()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("vpet-001")
    expect(frame).toContain("Very")
    expect(frame).toContain("Long")
    setup.renderer.destroy()
  })

  test("keeps the narrow title, content, and footer in the borderless body", async () => {
    const onClose = mock()
    const model: DexViewModel = { kind: "empty" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 32,
      height: 12,
    })
    await setup.flush()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("VPet Dex")
    expect(frame).toContain("Esc: Close")
    expect(frame).not.toContain("Search")
    expect(frame).not.toMatch(/[╭╮╰╯]/)
    setup.renderer.destroy()
  })

  test("keeps body content complete at normal host bounds", async () => {
    const onClose = mock()
    const model: DexViewModel = { kind: "empty" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 60,
      height: 20,
    })
    await setup.flush()

    const frame = setup.captureCharFrame()
    const lines = frame.split("\n")
    expect(frame).toContain("VPet Dex")
    expect(frame).toContain("No data available")
    expect(frame).toContain("Esc: Close")
    expect(lines.findIndex((line) => line.includes("VPet Dex"))).toBeLessThan(
      lines.findIndex((line) => line.includes("No data available")),
    )
    expect(lines.findIndex((line) => line.includes("No data available"))).toBeLessThan(
      lines.findIndex((line) => line.includes("Esc: Close")),
    )
    setup.renderer.destroy()
  })

  test("invokes onClose from the Dex footer close control", async () => {
    const onClose = mock()
    const model: DexViewModel = { kind: "empty" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetDexDialog theme={theme} model={model} onClose={onClose} />, {
      width: 32,
      height: 12,
    })
    await setup.flush()

    const closeRow = setup
      .captureCharFrame()
      .split("\n")
      .findIndex((line) => line.includes("Esc: Close"))
    await setup.mockMouse.click(5, closeRow)
    await setup.flush()

    expect(onClose).toHaveBeenCalledTimes(1)
    setup.renderer.destroy()
  })
})
