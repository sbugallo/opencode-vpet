import { describe, expect, test } from "bun:test"

import type { DigimonCatalog, DigimonNode } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { getSidebarCardInputs } from "@jcendal/digital-pet-core/application/use-cases/get-sidebar-card-inputs.ts"

const agumon: DigimonNode = {
  id: "3-001",
  nameEn: "Agumon",
  nameJp: "Agumon",
  nextEvolutions: [],
  sprite: "agumon",
  stage: 3,
  url: "https://example.test/agumon",
}

const egg: DigimonNode = {
  id: "0-001",
  nameEn: "Digitama",
  nameJp: "Digitama",
  nextEvolutions: [],
  sprite: "egg",
  stage: 0,
  url: "https://example.test/egg",
}

const catalog: DigimonCatalog = {
  nodes: [agumon, egg],
  byId: new Map([
    [agumon.id, agumon],
    [egg.id, egg],
  ]),
}

const snapshotFields = {
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
} as const

describe("get sidebar card inputs", () => {
  test("Given a reader without a snapshot When querying sidebar card inputs Then it returns no partner", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => null,
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({ kind: "no_partner" })
  })

  test("Given a reader with a catalogued partner snapshot When querying sidebar card inputs Then it preserves partner card fields", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: agumon.id,
        gauge: 25_000,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 40_000,
        ...snapshotFields,
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({
      kind: "partner",
      node: agumon,
      gauge: 25_000,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 40_000,
      evolutionBattlePending: false,
    })
  })

  test("Given a pending evolution battle When querying sidebar card inputs Then evolutionBattlePending is true", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: agumon.id,
        gauge: 25_000,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 40_000,
        pendingEvolutionTargetId: "4-017",
        battleOpponentNodeId: "3-051",
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({
      kind: "partner",
      node: agumon,
      gauge: 25_000,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 40_000,
      evolutionBattlePending: true,
    })
  })
})
