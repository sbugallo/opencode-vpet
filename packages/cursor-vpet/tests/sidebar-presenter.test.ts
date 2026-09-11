import { describe, expect, test } from "bun:test"

import { buildSidebarPresentation } from "../src/webview/sidebar/sidebar-presenter.ts"
import { buildNextCheckLine } from "../src/webview/sidebar/sidebar-render.ts"

describe("sidebar presenter", () => {
  test("builds no_partner payload when snapshot is null", () => {
    const presentation = buildSidebarPresentation(null)
    expect(presentation.payload.kind).toBe("no_partner")
    expect(presentation.partner).toBeUndefined()
  })

  test("builds partner payload and animation identity for an active partner", () => {
    const presentation = buildSidebarPresentation({
      currentNodeId: "3-001",
      gauge: 10,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 100,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })

    expect(presentation.payload.kind).toBe("partner")
    expect(presentation.partner).toEqual({ sprite: "agumon", isDigitama: false })
  })

  test("builds evolution battle pending next-check line for the sidebar card", () => {
    const presentation = buildSidebarPresentation({
      currentNodeId: "3-001",
      gauge: 50,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 500,
      pendingEvolutionTargetId: "4-017",
      battleOpponentNodeId: "3-051",
    })

    if (presentation.payload.kind !== "partner") throw new Error("Expected partner payload")
    expect(presentation.payload.nextCheck).toBe("Next check: Evolution battle!")
    expect(
      buildNextCheckLine({
        kind: "partner",
        name: "Agumon",
        sprite: "agumon",
        stage: "Child",
        stageNumber: 3,
        url: "https://example.test/agumon",
        gauge: 50,
        threshold: 100,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        evolutionBattlePending: true,
      }),
    ).toBe("Next check: Evolution battle!")
  })

  test("marks digitama partners for the animation host", () => {
    const presentation = buildSidebarPresentation({
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 0,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })

    expect(presentation.partner).toEqual({ sprite: "egg", isDigitama: true })
  })
})
