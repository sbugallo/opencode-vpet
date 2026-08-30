import { describe, expect, test } from "bun:test"

import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import type { DigimonNode } from "../src/domain/digimon-node.ts"
import { buildHistoryViewModel } from "../src/tui/history-view-model.ts"

const eggNode: DigimonNode = {
  id: "0-001",
  nameEn: "Egg",
  nameJp: "Egg JP",
  nextEvolutions: [],
  sprite: "egg",
  stage: 0,
  url: "https://example.test/0-001",
}
const catalog = {
  nodes: [
    eggNode,
    {
      id: "3-001",
      nameEn: "Child",
      nameJp: "Child JP",
      nextEvolutions: [],
      sprite: "child",
      stage: 3,
      url: "https://example.test/3-001",
    },
  ],
  byId: new Map([[eggNode.id, eggNode]]),
} as const

describe("history view model", () => {
  test("Given canonical generations with equal timestamps and repeated snapshots When building history Then generations sort deterministically and only adjacent IDs dedupe", () => {
    const model = buildHistoryViewModel(
      {
        kind: "available",
        partners: [
          {
            partnerId: "partner-a",
            generation: 2,
            createdAt: "2026-08-24T10:00:00.000Z",
            retiredAt: null,
            events: [
              { eventId: "event-1", currentNodeId: "0-001", createdAt: "2026-08-24T10:00:00.000Z" },
              { eventId: "event-2", currentNodeId: "0-001", createdAt: "2026-08-24T10:01:00.000Z" },
              { eventId: "event-3", currentNodeId: "missing-node", createdAt: "2026-08-24T10:02:00.000Z" },
              { eventId: "event-4", currentNodeId: "missing-node", createdAt: "2026-08-24T10:03:00.000Z" },
              { eventId: "event-5", currentNodeId: "0-001", createdAt: "2026-08-24T10:04:00.000Z" },
            ],
          },
          { partnerId: "partner-z", generation: 2, createdAt: "2026-08-24T10:00:00.000Z", retiredAt: null, events: [] },
          {
            partnerId: "partner-new",
            generation: 1,
            createdAt: "2026-08-24T11:00:00.000Z",
            retiredAt: null,
            events: [],
          },
        ],
      },
      catalog,
      DEFAULT_VPET_SETTINGS,
    )

    expect(model).toEqual({
      kind: "available",
      generations: [
        { partnerId: "partner-new", generation: 1, createdAt: "2026-08-24T11:00:00.000Z", retiredAt: null, path: [] },
        { partnerId: "partner-z", generation: 2, createdAt: "2026-08-24T10:00:00.000Z", retiredAt: null, path: [] },
        {
          partnerId: "partner-a",
          generation: 2,
          createdAt: "2026-08-24T10:00:00.000Z",
          retiredAt: null,
          path: ["0-001 Egg JP", "missing-node", "0-001 Egg JP"],
        },
      ],
    })
  })

  test("Given a retired generation When building history Then it retains creation and retirement state for its dialog header", () => {
    const model = buildHistoryViewModel(
      {
        kind: "available",
        partners: [
          {
            partnerId: "partner-retired",
            generation: 1,
            createdAt: "2026-08-24T09:00:00.000Z",
            retiredAt: "2026-08-24T10:00:00.000Z",
            events: [],
          },
        ],
      },
      catalog,
      DEFAULT_VPET_SETTINGS,
    )

    expect(model).toEqual({
      kind: "available",
      generations: [
        {
          partnerId: "partner-retired",
          generation: 1,
          createdAt: "2026-08-24T09:00:00.000Z",
          retiredAt: "2026-08-24T10:00:00.000Z",
          path: [],
        },
      ],
    })
  })

  test("Given an empty or unavailable archive When building history Then it preserves the explicit result state", () => {
    expect(buildHistoryViewModel({ kind: "empty" }, catalog, DEFAULT_VPET_SETTINGS)).toEqual({ kind: "empty" })
    expect(
      buildHistoryViewModel({ kind: "unavailable", message: "Archive unavailable" }, catalog, DEFAULT_VPET_SETTINGS),
    ).toEqual({ kind: "unavailable", message: "Archive unavailable" })
  })
})
