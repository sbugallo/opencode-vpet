/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { createMockMouse } from "@opentui/core/testing"
import { testRender } from "@opentui/solid"

import { MONSTER_FRAME_CATALOG, type MonsterFrame } from "../src/data/monster-frame-catalog.ts"
import { mirrorMonsterFrame } from "../src/tui/monster-artwork-mirror.ts"
import type { MonsterAnimationOutput } from "../src/tui/monster-animation.ts"
import { VpetSidebarCard } from "../src/tui/sidebar-card.tsx"

const agumonFrame = (): MonsterFrame => {
  const frame = MONSTER_FRAME_CATALOG.get("agumon", "angry")
  if (frame === undefined) throw new Error("Expected Agumon angry frame fixture")
  return frame
}

const animation =
  (output: MonsterAnimationOutput): (() => MonsterAnimationOutput) =>
  () =>
    output

const partnerModel = () => ({
  kind: "partner" as const,
  name: "Agumon",
  sprite: "agumon",
  stage: "Child",
  stageNumber: 3,
  url: "https://example.test/agumon",
  gauge: 25_000,
  threshold: 100_000,
  isTerminal: false,
  frozen: false,
  isSetOverride: false,
})

const frameOutput = (offset: number, facing: "left" | "right" = "left"): MonsterAnimationOutput => ({
  kind: "walking",
  result: { kind: "frame", frame: agumonFrame() },
  offset,
  facing,
})

describe("VPet sidebar frame", () => {
  test("Given a persisted Agumon and animation frame When rendering at sidebar width Then it centers exact artwork above five status rows", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            ...partnerModel(),
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const frame = setup.captureCharFrame()
    const lines = frame.trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines.every((line) => line.length === 80)).toBe(true)
    expect(lines[0]).toBe("─".repeat(80))
    expect(lines[14]).toBe("─".repeat(80))
    for (const [index, row] of agumonFrame().content.split("\n").entries()) {
      expect(lines[index + 1]?.slice(32, 48)).toBe(row)
    }
    expect(lines[9]?.trimEnd()).toBe("Agumon")
    expect(lines[10]?.trimEnd()).toBe("Child")
    expect(lines[11]?.trimEnd()).toBe(`Next check: [${"█".repeat(16)}${"░".repeat(50)}]`)
    expect(lines[12]?.trimEnd()).toBe("25,000/100,000")
    expect(lines[13]?.trimEnd()).toBe("Encyclopedia entry")
    expect(frame).not.toContain("Total tokens")
    expect(frame).not.toContain("sprite")

    setup.renderer.destroy()
  })

  test("Given a walking output at either legal edge When rendering at 80 or 60 columns Then each exact source row stays within the artwork viewport", async () => {
    for (const [width, offset, start] of [
      [80, -32, 0],
      [80, 32, 64],
      [60, -22, 0],
      [60, 22, 44],
    ] as const) {
      const setup = await testRender(
        () => <VpetSidebarCard model={partnerModel} animation={animation(frameOutput(offset))} />,
        { width, height: 24 },
      )

      await setup.flush()
      const lines = setup.captureCharFrame().trimEnd().split("\n")
      for (const [index, row] of agumonFrame().content.split("\n").entries()) {
        expect(lines[index + 1]?.slice(start, start + 16)).toBe(row)
      }
      setup.renderer.destroy()
    }
  })

  test("Given right-facing walking output at 80 and 60 columns When rendering Then it projects the exact mirrored frame at each signed edge", async () => {
    const mirrored = mirrorMonsterFrame(agumonFrame())
    if (mirrored.kind !== "mirrored") throw new Error("Expected valid Agumon mirror fixture")
    for (const [width, offset, start] of [
      [80, 32, 64],
      [60, 22, 44],
    ] as const) {
      const setup = await testRender(
        () => <VpetSidebarCard model={partnerModel} animation={animation(frameOutput(offset, "right"))} />,
        { width, height: 24 },
      )

      await setup.flush()
      const lines = setup.captureCharFrame().trimEnd().split("\n")
      for (const [index, row] of mirrored.frame.content.split("\n").entries()) {
        expect(lines[index + 1]?.slice(start, start + 16)).toBe(row)
      }
      setup.renderer.destroy()
    }
  })

  test("Given an artwork viewport resize When rendering Then it reports only integer width changes and keeps the supplied animation phase", async () => {
    const widths: number[] = []
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={partnerModel}
          animation={animation(frameOutput(0))}
          onArtworkWidthChange={(width) => widths.push(width)}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    setup.renderer.resize(60, 24)
    await setup.flush()
    setup.renderer.resize(80, 24)
    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    for (const [index, row] of agumonFrame().content.split("\n").entries()) {
      expect(lines[index + 1]?.slice(32, 48)).toBe(row)
    }
    expect(lines[11]?.trimEnd()).toBe(`Next check: [${"█".repeat(16)}${"░".repeat(50)}]`)
    expect(widths).toEqual([80, 60, 80])

    setup.renderer.destroy()
  })

  test.each([15, 16])(
    "Given a %i-column artwork viewport When rendering a right-facing frame Then it pins at origin without disturbing status rows",
    async (width) => {
      const setup = await testRender(
        () => <VpetSidebarCard model={partnerModel} animation={animation(frameOutput(32, "right"))} />,
        { width, height: 24 },
      )

      await setup.flush()
      const lines = setup.captureCharFrame().trimEnd().split("\n")
      expect(lines).toHaveLength(15)
      expect(lines[9]?.trimEnd()).toBe("Agumon")
      expect(lines[10]?.trimEnd()).toBe("Child")
      expect(lines[12]?.trimEnd()).toBe("25,000/100,000")
      setup.renderer.destroy()
    },
  )

  test("Given a normal stage at a tight sidebar width When rendering Then it retains the five existing status rows", async () => {
    const setup = await testRender(
      () => <VpetSidebarCard model={partnerModel} animation={animation(frameOutput(0))} />,
      { width: 16, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[10]?.trimEnd()).toBe("Child")
    expect(lines[11]?.trimEnd()).toMatch(/^Next check: /)
    expect(lines[12]?.trimEnd()).toBe("25,000/100,000")

    setup.renderer.destroy()
  })

  test("Given a frozen stage at a tight sidebar width When rendering Then it truncates on the existing stage row", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            ...partnerModel(),
            stage: "Child",
            stageNumber: 3,
            gauge: 42,
            threshold: 1_000,
            frozen: true,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 16, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[10]?.trimEnd()).toBe("Child (frozen)")
    expect(lines[11]?.trimEnd()).toMatch(/^Next check: /)
    expect(lines[12]?.trimEnd()).toBe("42/1,000")

    setup.renderer.destroy()
  })

  test("Given localized terminal card models When rendering Then it displays exact configured name-stage pairs and placeholders", async () => {
    const japaneseSetup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            kind: "partner",
            name: "Tailmon",
            sprite: "tailmon",
            stage: "Adult",
            stageNumber: 4,
            url: "https://example.test/tailmon",
            gauge: 500_000,
            threshold: 500_000,
            isTerminal: true,
            frozen: false,
            isSetOverride: false,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )
    await japaneseSetup.flush()
    const japaneseFrame = japaneseSetup.captureCharFrame()

    expect(japaneseFrame).toContain("Tailmon")
    expect(japaneseFrame).toContain("Adult")
    expect(japaneseFrame).toContain("-/-")

    japaneseSetup.renderer.destroy()

    const englishSetup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            kind: "partner",
            name: "Gatomon",
            sprite: "gatomon",
            stage: "Champion",
            stageNumber: 4,
            url: "https://example.test/gatomon",
            gauge: 777,
            threshold: 777,
            isTerminal: true,
            frozen: false,
            isSetOverride: false,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )
    await englishSetup.flush()
    const englishFrame = englishSetup.captureCharFrame()

    expect(englishFrame).toContain("Gatomon")
    expect(englishFrame).toContain("Champion")
    expect(englishFrame).toContain("-/-")

    englishSetup.renderer.destroy()
  })

  test("Given a terminal partner When rendering Then it shows terminal placeholders instead of check values", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            kind: "partner",
            name: "Agumon",
            sprite: "agumon",
            stage: "Child",
            stageNumber: 3,
            url: "https://example.test/agumon",
            gauge: 0,
            threshold: 100_000,
            isTerminal: true,
            frozen: false,
            isSetOverride: false,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines[11]?.trimEnd()).toBe("Next check: None")
    expect(lines[12]?.trimEnd()).toBe("-/-")
    expect(lines[10]?.trimEnd()).toBe("Child")
    expect(setup.captureCharFrame()).not.toContain("CHEAT")
    expect(setup.captureCharFrame()).not.toContain("Frozen")

    setup.renderer.destroy()
  })

  test("Given a frozen canonical Digitama When rendering Then it appends frozen to the existing stage row without changing status rows", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            kind: "partner",
            name: "Digitama",
            sprite: "egg",
            stage: "Digitama",
            stageNumber: 0,
            url: "https://example.test/digitama",
            gauge: 42,
            threshold: 1_000,
            isTerminal: false,
            frozen: true,
            isSetOverride: false,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[9]?.trimEnd()).toBe("Digitama")
    expect(lines[10]?.trimEnd()).toBe("Digitama (frozen)")
    expect(lines[11]?.trimEnd()).toBe(`Next check: [${"█".repeat(2)}${"░".repeat(64)}]`)
    expect(lines[12]?.trimEnd()).toBe("42/1,000")
    expect(lines).not.toContain("Frozen")

    setup.renderer.destroy()
  })

  test("Given a terminal cheat projection When rendering Then it suppresses frozen and never labels cheat", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            kind: "partner",
            name: "Agumon",
            sprite: "agumon",
            stage: "Child",
            stageNumber: 3,
            url: "https://example.test/agumon",
            gauge: 0,
            threshold: 100_000,
            isTerminal: true,
            frozen: false,
            isSetOverride: false,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const frame = setup.captureCharFrame()
    const lines = frame.trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[10]?.trimEnd()).toBe("Child")
    expect(frame).not.toContain("(frozen)")
    expect(frame).not.toContain("Frozen")
    expect(frame).not.toContain("CHEAT")
    expect(frame).toContain("Next check: None")
    expect(frame).toContain("-/-")

    setup.renderer.destroy()
  })

  test("Given a valid set-override card When rendering Then it appends set to the existing name row without touching stage or status rows", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            ...partnerModel(),
            gauge: 0,
            isTerminal: true,
            isSetOverride: true,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const frame = setup.captureCharFrame()
    const lines = frame.trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[9]?.trimEnd()).toBe("Agumon (set)")
    expect(lines[10]?.trimEnd()).toBe("Child")
    expect(lines[11]?.trimEnd()).toBe(`Next check: [${"█".repeat(66)}]`)
    expect(lines[12]?.trimEnd()).toBe("-/-")
    expect(frame).not.toContain("CHEAT")
    expect(frame).not.toContain("(frozen)")

    setup.renderer.destroy()
  })

  test("Given a frozen set-override card When rendering Then set and frozen markers stay on their separate name and stage rows", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            ...partnerModel(),
            frozen: true,
            isSetOverride: true,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[9]?.trimEnd()).toBe("Agumon (set)")
    expect(lines[10]?.trimEnd()).toBe("Child (frozen)")
    expect(lines[12]?.trimEnd()).toBe("25,000/100,000")

    setup.renderer.destroy()
  })

  test("Given a set-override name at a tight sidebar width When rendering Then it truncates on the existing name row without wrapping", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({
            ...partnerModel(),
            name: "SuperUltimate",
            isSetOverride: true,
          })}
          animation={animation(frameOutput(0))}
        />
      ),
      { width: 16, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines[9]).toBe("SuperU...e (set)")
    expect(lines[10]?.trimEnd()).toBe("Child")
    expect(lines[11]?.trimEnd()).toMatch(/^Next check: /)
    expect(lines[12]?.trimEnd()).toBe("25,000/100,000")

    setup.renderer.destroy()
  })

  test("Given no active partner and blank animation When rendering Then the eight-row canvas is blank and its message remains below it", async () => {
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({ kind: "no_partner", messageLine: "No active partner" })}
          animation={animation({ kind: "blank", result: { kind: "blank" }, offset: 0, facing: "left" })}
        />
      ),
      { width: 80, height: 24 },
    )

    await setup.flush()
    const lines = setup.captureCharFrame().trimEnd().split("\n")

    expect(lines).toHaveLength(15)
    expect(lines.slice(1, 9).every((line) => line.trim() === "")).toBe(true)
    expect(lines[9]?.trimEnd()).toBe("No active partner")
    expect(lines[13]?.trimEnd()).toBe("")
    expect(setup.captureCharFrame()).not.toContain("(set)")

    setup.renderer.destroy()
  })

  test.each([
    ["unknown", "unknown-sprite", "Artwork unavailable: unknown-sprite"],
    ["empty", "", "Artwork unavailable: (empty)"],
  ] as const)(
    "Given a %s active sprite without artwork When rendering Then it centers its canvas error and preserves partner status rows",
    async (_caseName, sprite, message) => {
      const setup = await testRender(
        () => (
          <VpetSidebarCard
            model={() => ({
              kind: "partner",
              name: "Agumon",
              sprite,
              stage: "Child",
              stageNumber: 3,
              url: "https://example.test/agumon",
              gauge: 25_000,
              threshold: 100_000,
              isTerminal: false,
              frozen: false,
              isSetOverride: false,
            })}
            animation={animation({
              kind: "unavailable",
              result: { kind: "unavailable", sprite },
              offset: 0,
              facing: "left",
            })}
          />
        ),
        { width: 80, height: 24 },
      )

      await setup.flush()
      const lines = setup.captureCharFrame().trimEnd().split("\n")

      expect(lines[4]?.slice((80 - message.length) / 2, (80 + message.length) / 2)).toBe(message)
      expect(lines[9]?.trimEnd()).toBe("Agumon")
      expect(lines[10]?.trimEnd()).toBe("Child")
      expect(lines[11]?.trimEnd()).toBe(`Next check: [${"█".repeat(16)}${"░".repeat(50)}]`)
      expect(lines[12]?.trimEnd()).toBe("25,000/100,000")
      expect(lines[13]?.trimEnd()).toBe("Encyclopedia entry")

      setup.renderer.destroy()
    },
  )

  test("Given a partner card When its url row is clicked Then it opens through the injected handler exactly once", async () => {
    const openedUrls: string[] = []
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={partnerModel}
          animation={animation(frameOutput(0))}
          onUrlClick={(url) => openedUrls.push(url)}
        />
      ),
      { width: 80, height: 24 },
    )
    const mouse = createMockMouse(setup.renderer)

    await setup.flush()
    await mouse.click(2, 13)
    await setup.flush()

    expect(openedUrls).toEqual([partnerModel().url])

    setup.renderer.destroy()
  })

  test("Given no active partner When any row is clicked Then it never invokes the injected url handler", async () => {
    const openedUrls: string[] = []
    const setup = await testRender(
      () => (
        <VpetSidebarCard
          model={() => ({ kind: "no_partner", messageLine: "No active partner" })}
          animation={animation({ kind: "blank", result: { kind: "blank" }, offset: 0, facing: "left" })}
          onUrlClick={(url) => openedUrls.push(url)}
        />
      ),
      { width: 80, height: 24 },
    )
    const mouse = createMockMouse(setup.renderer)

    await setup.flush()
    await mouse.click(2, 9)
    await mouse.click(2, 13)
    await setup.flush()

    expect(openedUrls).toEqual([])

    setup.renderer.destroy()
  })
})
