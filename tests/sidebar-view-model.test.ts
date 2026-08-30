import { describe, expect, test } from "bun:test"

import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { normalizeVpetSettings } from "../src/config/normalize.ts"
import { buildSidebarCardModel } from "../src/tui/sidebar-view-model.ts"

describe("static sidebar model", () => {
  const partnerInputs = {
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
    gauge: 25_000,
    isTerminal: false,
    frozen: false,
    isSetOverride: false,
    trainerTotalTokens: 25_000,
  } as const

  test("Given default Japanese settings When building the sidebar model Then it renders catalog Japanese names and familiar labels", () => {
    const model = buildSidebarCardModel(partnerInputs, DEFAULT_VPET_SETTINGS)

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(Object.keys(model).sort()).toEqual([
      "frozen",
      "gauge",
      "isSetOverride",
      "isTerminal",
      "kind",
      "name",
      "sprite",
      "stage",
      "stageNumber",
      "threshold",
      "url",
    ])
    expect(model.name).toBe("Tailmon")
    expect(model.stage).toBe("Adult")
    expect(model.stageNumber).toBe(4)
    expect(model.url).toBe("https://example.test/tailmon")
    expect(model.gauge).toBe(25_000)
    expect(model.threshold).toBe(7_500_000)
    expect(model.isTerminal).toBe(false)
    expect(model.frozen).toBe(false)
  })

  test.each([
    ["a distinctive sprite key", "tailmon-walk-02"],
    ["an empty sprite key", ""],
  ])("Given %s When building the sidebar model Then it projects the sprite unchanged", (_description, sprite) => {
    const model = buildSidebarCardModel(
      {
        ...partnerInputs,
        node: { ...partnerInputs.node, sprite },
      },
      DEFAULT_VPET_SETTINGS,
    )

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(model.sprite).toBe(sprite)
  })

  test("Given a stage-zero partner When building the sidebar model Then its existing Digitama presentation remains unchanged", () => {
    const model = buildSidebarCardModel(
      {
        ...partnerInputs,
        node: { ...partnerInputs.node, stage: 0, sprite: "not-an-egg" },
      },
      DEFAULT_VPET_SETTINGS,
    )

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(model.stage).toBe("Digitama")
    expect(model.stageNumber).toBe(0)
    expect(model.sprite).toBe("not-an-egg")
  })

  test("Given a frozen canonical partner When building the sidebar model Then it preserves the frozen display state", () => {
    const model = buildSidebarCardModel({ ...partnerInputs, frozen: true }, DEFAULT_VPET_SETTINGS)

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(model.frozen).toBe(true)
    expect(model.isSetOverride).toBe(false)
  })

  test("Given a set-override cheat partner When building the sidebar model Then it preserves the set display state", () => {
    const model = buildSidebarCardModel({ ...partnerInputs, isSetOverride: true }, DEFAULT_VPET_SETTINGS)

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(model.isSetOverride).toBe(true)
    expect(model.frozen).toBe(false)
  })

  test("Given English settings with a custom threshold When building the sidebar model Then one language selects both English display fields", () => {
    const settings = normalizeVpetSettings({ language: "en", stageThresholds: { adult: 777 } })
    const model = buildSidebarCardModel(partnerInputs, settings)

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(model.name).toBe("Gatomon")
    expect(model.stage).toBe("Champion")
    expect(model.threshold).toBe(777)
  })

  test("Given invalid settings and a terminal partner When building the sidebar model Then it uses the resolved default presentation values", () => {
    const settings = normalizeVpetSettings({ language: "fr", stageThresholds: { adult: 0 } })
    const model = buildSidebarCardModel({ ...partnerInputs, isTerminal: true }, settings)

    if (model.kind !== "partner") throw new Error("Expected partner sidebar model")

    expect(model.name).toBe("Tailmon")
    expect(model.stage).toBe("Adult")
    expect(model.threshold).toBe(7_500_000)
    expect(model.isTerminal).toBe(true)
  })

  test("Given no partner inputs When building the sidebar model Then it preserves the no-partner presentation", () => {
    const model = buildSidebarCardModel(
      {
        kind: "no_partner",
      },
      DEFAULT_VPET_SETTINGS,
    )

    expect(model).toEqual({ kind: "no_partner", messageLine: "No active partner" })
  })
})
