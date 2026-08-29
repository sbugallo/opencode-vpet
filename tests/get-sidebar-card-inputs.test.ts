import { describe, expect, test } from "bun:test"

import type { DigimonCatalog, DigimonNode } from "../src/data/catalog.ts"
import type { SidebarSnapshotReader } from "../src/application/ports/sidebar-snapshot.ts"
import { getSidebarCardInputs } from "../src/application/use-cases/get-sidebar-card-inputs.ts"

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

describe("get sidebar card inputs", () => {
  test("Given a reader without a snapshot When querying sidebar card inputs Then it returns no partner", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => null,
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({ kind: "no_partner" })
  })

  test("Given a reader with a catalogued partner snapshot When querying sidebar card inputs Then it preserves all partner card fields", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: agumon.id,
        gauge: 25_000,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 40_000,
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
    })
  })

  test("Given a reader with a snapshot for an unknown catalog node When querying sidebar card inputs Then it returns no partner", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: "unknown",
        gauge: 25_000,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 40_000,
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({ kind: "no_partner" })
  })

  test("Given a stale cheat snapshot for an unknown catalog node When querying sidebar card inputs Then it returns no partner without any set marker state", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: "stale-node",
        gauge: 0,
        isTerminal: true,
        frozen: false,
        isSetOverride: true,
        trainerTotalTokens: 40_000,
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({ kind: "no_partner" })
  })

  test("Given a terminal cheat snapshot for a catalog node When querying sidebar card inputs Then it preserves the terminal empty-gauge set projection", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: agumon.id,
        gauge: 0,
        isTerminal: true,
        frozen: false,
        isSetOverride: true,
        trainerTotalTokens: 40_000,
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({
      kind: "partner",
      node: agumon,
      gauge: 0,
      isTerminal: true,
      frozen: false,
      isSetOverride: true,
      trainerTotalTokens: 40_000,
    })
  })

  test("Given a reset egg snapshot after spawn When querying sidebar card inputs Then it restores the canonical non-terminal egg projection", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: egg.id,
        gauge: 0,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 40_000,
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({
      kind: "partner",
      node: egg,
      gauge: 0,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 40_000,
    })
  })

  test("Given a frozen canonical Digitama snapshot When querying sidebar card inputs Then it preserves frozen for the typed display projection", () => {
    const reader: SidebarSnapshotReader = {
      getSidebarSnapshot: () => ({
        currentNodeId: egg.id,
        gauge: 42,
        isTerminal: false,
        frozen: true,
        isSetOverride: false,
        trainerTotalTokens: 40_000,
      }),
    }

    expect(getSidebarCardInputs(reader, catalog)).toEqual({
      kind: "partner",
      node: egg,
      gauge: 42,
      isTerminal: false,
      frozen: true,
      isSetOverride: false,
      trainerTotalTokens: 40_000,
    })
  })
})
