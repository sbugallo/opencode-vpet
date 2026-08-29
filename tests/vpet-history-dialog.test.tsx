/** @jsxImportSource @opentui/solid */
import { describe, expect, test, mock } from "bun:test"
import { ScrollBoxRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { VpetHistoryDialog, type VpetHistoryDialogTheme } from "../src/tui/vpet-history-dialog.tsx"
import type { HistoryViewModel } from "../src/tui/history-view-model.ts"
import { parseColor } from "@opentui/core"
import { createTrackedDialogApi } from "./vpet-dex-dialog-fixture.tsx"

const createMockTheme = (): VpetHistoryDialogTheme => {
  return {
    current: {
      primary: parseColor("#0000ff"),
    },
  }
}

describe("VpetHistoryDialog", () => {
  test("renders empty state without invoking a nested Dialog", async () => {
    const onClose = mock()
    const model: HistoryViewModel = { kind: "empty" }
    const { theme, Dialog } = createTrackedDialogApi()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("No data available")
    expect(Dialog).toHaveBeenCalledTimes(0)
    setup.renderer.destroy()
  })

  test("renders history", async () => {
    const onClose = mock()
    const model: HistoryViewModel = {
      kind: "available",
      generations: [
        { partnerId: "p1", generation: 1, createdAt: "2024-01-01", retiredAt: null, path: ["egg", "botamon"] },
        { partnerId: "p2", generation: 2, createdAt: "2024-01-02", retiredAt: "2024-01-03", path: [] },
      ],
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()
    let frame = setup.captureCharFrame()
    expect(frame).toContain("Generation 1 — 2024-01-01 — Active")
    expect(frame).toContain("egg → botamon")
    setup.mockInput.pressArrow("down")
    await setup.flush()
    frame = setup.captureCharFrame()
    expect(frame).toContain("Generation 2 — 2024-01-02 — Retired")
    setup.renderer.destroy()
  })

  test("wraps path text rather than truncating at narrow width", async () => {
    const onClose = mock()
    const model: HistoryViewModel = {
      kind: "available",
      generations: [
        {
          partnerId: "p1",
          generation: 1,
          createdAt: "2024-01-01",
          retiredAt: null,
          path: ["agumon", "greymon", "metalgreymon", "wargreymon", "botamon"],
        },
      ],
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 30,
      height: 24,
    })
    await setup.flush()
    let frame = setup.captureCharFrame()
    expect(frame).toContain("agumon")
    expect(frame).toContain("greymon")
    for (let i = 0; i < 3; i++) {
      setup.mockInput.pressArrow("down")
    }
    await setup.flush()
    frame = setup.captureCharFrame()
    expect(frame).toContain("metalgreymon")
    expect(frame).toContain("wargreymon")
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
    const model: HistoryViewModel = { kind: "empty" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 24,
    })
    await setup.flush()

    setup.mockInput.pressEscape()
    await escapePromise

    expect(onClose).toHaveBeenCalledTimes(1)
    setup.renderer.destroy()
  })

  test("scrolls long content down", async () => {
    const onClose = mock()
    const generations = Array.from({ length: 50 }).map((_, i) => ({
      partnerId: `p${i}`,
      generation: i,
      createdAt: `2024-01-${(i % 31).toString().padStart(2, "0")}`,
      retiredAt: `2024-01-${((i + 1) % 31).toString().padStart(2, "0")}`,
      path: ["egg", "botamon"],
    }))

    const model: HistoryViewModel = {
      kind: "available",
      generations,
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 10,
    })
    await setup.flush()

    let frame = setup.captureCharFrame()
    expect(frame).toContain("Generation 0")
    expect(frame).not.toContain("Generation 49")

    for (let i = 0; i < 30; i++) {
      setup.mockInput.pressArrow("down")
    }
    await setup.flush()

    frame = setup.captureCharFrame()
    expect(frame).not.toContain("Generation 0")

    setup.renderer.destroy()
  })

  test("Given overflowing history When the borderless body renders Then its native scrollbar shares the content viewport and the footer stays below it", async () => {
    const onClose = mock()
    const model: HistoryViewModel = {
      kind: "available",
      generations: Array.from({ length: 20 }, (_, index) => ({
        partnerId: `partner-${index}`,
        generation: index,
        createdAt: "2024-01-01",
        retiredAt: null,
        path: ["egg", "botamon"],
      })),
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 32,
      height: 12,
    })
    await setup.flush()

    const renderable = setup.renderer.root.findDescendantById("vpet-history-scrollbox")
    if (!(renderable instanceof ScrollBoxRenderable)) throw new Error("Expected native History scrollbox")

    const frame = setup.captureCharFrame()
    const footerRow = frame.split("\n").findIndex((line) => line.includes("Esc: Close"))
    expect(renderable.primaryAxis).toBe("row")
    expect(renderable.verticalScrollBar.x).toBe(renderable.viewport.x + renderable.viewport.width)
    expect(renderable.verticalScrollBar.y).toBe(renderable.viewport.y)
    expect(renderable.verticalScrollBar.height).toBe(renderable.viewport.height)
    expect(footerRow).toBeGreaterThan(renderable.y + renderable.height - 1)
    expect(frame).toContain("VPet History")
    expect(frame).toContain("Esc: Close")
    expect(frame).not.toMatch(/[╭╮╰╯]/)
    setup.renderer.destroy()
  })

  test("Given overflowing history When arrow navigation runs Then it scrolls one or ten history rows through the native scrollbox", async () => {
    const onClose = mock()
    const model: HistoryViewModel = {
      kind: "available",
      generations: Array.from({ length: 50 }, (_, index) => ({
        partnerId: `partner-${index}`,
        generation: index,
        createdAt: "2024-01-01",
        retiredAt: null,
        path: ["egg", "botamon"],
      })),
    }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 80,
      height: 10,
    })
    await setup.flush()

    const renderable = setup.renderer.root.findDescendantById("vpet-history-scrollbox")
    if (!(renderable instanceof ScrollBoxRenderable)) throw new Error("Expected native History scrollbox")

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
    expect(setup.captureCharFrame()).toContain("↑↓: 1 item · ←→: 10 items · Esc: Close")

    setup.renderer.destroy()
  })

  test("keeps body content complete at normal host bounds", async () => {
    const onClose = mock()
    const model: HistoryViewModel = { kind: "empty" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
      width: 60,
      height: 20,
    })
    await setup.flush()

    const frame = setup.captureCharFrame()
    const lines = frame.split("\n")
    expect(frame).toContain("VPet History")
    expect(frame).toContain("No data available")
    expect(frame).toContain("Esc: Close")
    expect(lines.findIndex((line) => line.includes("VPet History"))).toBeLessThan(
      lines.findIndex((line) => line.includes("No data available")),
    )
    expect(lines.findIndex((line) => line.includes("No data available"))).toBeLessThan(
      lines.findIndex((line) => line.includes("Esc: Close")),
    )
    setup.renderer.destroy()
  })

  test("invokes onClose from the History footer close control", async () => {
    const onClose = mock()
    const model: HistoryViewModel = { kind: "empty" }
    const theme = createMockTheme()
    const setup = await testRender(() => <VpetHistoryDialog theme={theme} model={model} onClose={onClose} />, {
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
