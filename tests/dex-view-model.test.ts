import { describe, expect, test } from "bun:test"

import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { buildDexViewModel } from "../src/tui/dex-view-model.ts"

const catalog = {
  nodes: [
    {
      id: "0-010",
      nameEn: "Unseen Egg",
      nameJp: "Unseen Egg JP",
      nextEvolutions: [],
      sprite: "egg",
      stage: 0,
      url: "https://example.test/0-010",
    },
    {
      id: "0-002",
      nameEn: "Seen Egg",
      nameJp: "Seen Egg JP",
      nextEvolutions: [],
      sprite: "egg",
      stage: 0,
      url: "https://example.test/0-002",
    },
    {
      id: "3-010",
      nameEn: "Unseen Child",
      nameJp: "Unseen Child JP",
      nextEvolutions: [],
      sprite: "child",
      stage: 3,
      url: "https://example.test/3-010",
    },
    {
      id: "3-002",
      nameEn: "Seen Child",
      nameJp: "Seen Child JP",
      nextEvolutions: [],
      sprite: "child",
      stage: 3,
      url: "https://example.test/3-002",
    },
  ],
  byId: new Map(),
} as const

describe("Dex view model", () => {
  test("Given canonical archive events When building the Dex Then it contains every catalog row in stage and numeric ID order without leaking unseen names", () => {
    const model = buildDexViewModel(
      {
        kind: "available",
        partners: [
          {
            partnerId: "partner-1",
            generation: 1,
            createdAt: "2026-08-24T10:00:00.000Z",
            retiredAt: null,
            events: [{ eventId: "event-1", currentNodeId: "3-002", createdAt: "2026-08-24T10:01:00.000Z" }],
          },
        ],
      },
      catalog,
      DEFAULT_VPET_SETTINGS,
    )

    expect(model).toEqual({
      kind: "available",
      rows: [
        { id: "0-002", stage: "Digitama", discovered: false, name: "------" },
        { id: "0-010", stage: "Digitama", discovered: false, name: "------" },
        { id: "3-002", stage: "Child", discovered: true, name: "Seen Child JP" },
        { id: "3-010", stage: "Child", discovered: false, name: "------" },
      ],
    })
  })

  test("Given an empty or unavailable archive When building the Dex Then it preserves the explicit result state", () => {
    expect(buildDexViewModel({ kind: "empty" }, catalog, DEFAULT_VPET_SETTINGS)).toEqual({ kind: "empty" })
    expect(
      buildDexViewModel({ kind: "unavailable", message: "Archive unavailable" }, catalog, DEFAULT_VPET_SETTINGS),
    ).toEqual({ kind: "unavailable", message: "Archive unavailable" })
  })

  test("Given the production catalog When building the Dex Then it deterministically projects all 650 catalog IDs once", () => {
    const model = buildDexViewModel({ kind: "available", partners: [] }, DIGIMON_CATALOG, DEFAULT_VPET_SETTINGS)

    if (model.kind !== "available") throw new Error("Expected available Dex model")

    expect(model.rows).toHaveLength(650)
    expect(new Set(model.rows.map((row) => row.id)).size).toBe(650)
    expect(model.rows.every((row) => row.discovered === false && row.name === "------")).toBeTrue()
  })
})
