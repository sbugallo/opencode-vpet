import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { Database } from "bun:sqlite"

import { createSqliteVpetArchiveReader } from "../../src/adapters/sqlite/sqlite-vpet-archive-reader.ts"
import { openWritableDatabase } from "../../src/adapters/sqlite/bun-sqlite-driver.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { runVpetSetCommand } from "../../src/commands/vpet-set.ts"
import { DEFAULT_VPET_SETTINGS } from "../../src/config/defaults.ts"
import type { ResolvedVpetSettings } from "../../src/config/types.ts"
import type { DigimonCatalog } from "../../src/data/catalog.ts"
import type { DigimonNode } from "../../src/domain/digimon-node.ts"
import { buildDexViewModel } from "../../src/tui/dex-view-model.ts"
import { buildHistoryViewModel } from "../../src/tui/history-view-model.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"
import {
  applyReceipt,
  createTempTestRoot,
  getControlReceipts,
  removeTempTestRoot,
  spawn,
  type TempTestRoot,
  usageReceipt,
} from "./sqlite-vpet-repository.fixtures.ts"

const catalogNodes = [
  {
    id: "0-001",
    nameEn: "Egg English",
    nameJp: "Egg Japanese",
    nextEvolutions: [],
    sprite: "egg",
    stage: 0,
    url: "https://example.test/0-001",
  },
  {
    id: "1-001",
    nameEn: "First English",
    nameJp: "First Japanese",
    nextEvolutions: [],
    sprite: "first",
    stage: 1,
    url: "https://example.test/1-001",
  },
  {
    id: "2-001",
    nameEn: "Second English",
    nameJp: "Second Japanese",
    nextEvolutions: [],
    sprite: "second",
    stage: 2,
    url: "https://example.test/2-001",
  },
  {
    id: "7-001",
    nameEn: "Set-only English",
    nameJp: "Set-only Japanese",
    nextEvolutions: [],
    sprite: "set-only",
    stage: 7,
    url: "https://example.test/7-001",
  },
] as const satisfies readonly DigimonNode[]

const catalog: DigimonCatalog = {
  nodes: catalogNodes,
  byId: new Map(catalogNodes.map((node) => [node.id, node])),
}

const englishSettings = {
  ...DEFAULT_VPET_SETTINGS,
  language: "en",
} as const satisfies ResolvedVpetSettings

test("Given a set-only catalog ID without canonical events When projecting the Dex Then its English and Japanese names remain redacted", () => {
  const archive = {
    kind: "available",
    partners: [
      {
        partnerId: "partner-1",
        generation: 1,
        createdAt: "2026-07-30T12:00:00.000Z",
        retiredAt: null,
        events: [{ eventId: "event-spawn-1", currentNodeId: "0-001", createdAt: "2026-07-30T12:00:00.000Z" }],
      },
    ],
  } as const
  const englishDex = buildDexViewModel(archive, catalog, englishSettings)
  const japaneseDex = buildDexViewModel(archive, catalog, DEFAULT_VPET_SETTINGS)
  if (englishDex.kind !== "available" || japaneseDex.kind !== "available")
    throw new Error("Expected available Dex models")

  expect(englishDex.rows.find((row) => row.id === "7-001")?.name).toBe("------")
  expect(japaneseDex.rows.find((row) => row.id === "7-001")?.name).toBe("------")
  expect(englishDex.rows.map((row) => row.name)).not.toContain("Set-only English")
  expect(japaneseDex.rows.map((row) => row.name)).not.toContain("Set-only Japanese")
})

describe.if(isBunSqliteAvailable)("sqlite vpet archive history persistence", () => {
  let tempRoot: TempTestRoot

  beforeEach(async () => {
    tempRoot = await createTempTestRoot()
  })
  afterEach(async () => {
    await removeTempTestRoot(tempRoot)
  })

  test("Given canonical generations and a set-only control When the archive reopens Then discovery and history expose only canonical event state", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    let repositoryClosed = false

    try {
      const firstPartner = spawn(repository)
      expect(applyReceipt(repository, "receipt-first", "event-b-evolution", 100)).toEqual({ kind: "applied" })
      expect(
        repository.applyUsageReceipt(
          usageReceipt("receipt-same-snapshot", "event-c-same-snapshot", 100),
          (partner) => ({ currentNodeId: "1-001", gauge: partner.gauge + 100, isTerminal: false }),
        ),
      ).toEqual({ kind: "applied" })
      expect(
        repository.applyUsageReceipt(usageReceipt("receipt-second", "event-d-evolution", 100), (partner) => ({
          currentNodeId: "2-001",
          gauge: partner.gauge + 100,
          isTerminal: false,
        })),
      ).toEqual({ kind: "applied" })

      const secondPartner = spawn(repository, "2026-07-30T12:10:00.000Z")
      const setResult = await runVpetSetCommand(
        repository,
        { sessionID: "session-history", messageID: "set-history", arguments: "7-001" },
        async () => catalog,
      )
      expect(setResult.event).toEqual({ kind: "set", nodeId: "7-001" })
      expect(
        repository.applyUsageReceipt(usageReceipt("receipt-set-only", "event-set-only", 100), () => {
          throw new Error("Set-only receipt must not evolve canonical history")
        }),
      ).toEqual({ kind: "applied" })
      expect(getControlReceipts(repository.databasePath)).toEqual([{ receipt_key: "receipt-set-only", mode: "cheat" }])

      const database = openWritableDatabase(repository.databasePath)
      try {
        database.run(
          "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('partner-zero-events', 3, '0-001', 0, 0, '2026-07-30T12:30:00.000Z', '2026-07-30T12:31:00.000Z')",
        )
        database.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES ('event-unknown', ?, 'usage_applied', '99-999', 0, 0, NULL, NULL, '2026-07-30T12:11:00.000Z')",
          [secondPartner.partnerId],
        )
      } finally {
        database.close()
      }

      await repository.close()
      repositoryClosed = true

      const closeSpy = spyOn(Database.prototype, "close")
      try {
        const archive = createSqliteVpetArchiveReader({ databasePath: repository.databasePath }).getArchive()
        expect(closeSpy).toHaveBeenCalledTimes(1)
        if (archive.kind !== "available") throw new Error("Expected populated archive after canonical writes")

        const firstEventsAtTie = archive.partners
          .find((partner) => partner.partnerId === firstPartner.partnerId)
          ?.events.filter((event) => event.createdAt === "2026-07-30T12:05:00.000Z")
          .map((event) => event.eventId)
        expect(firstEventsAtTie).toEqual(["event-b-evolution", "event-c-same-snapshot", "event-d-evolution"])
        expect(archive.partners.flatMap((partner) => partner.events.map((event) => event.currentNodeId))).not.toContain(
          "7-001",
        )

        const englishDex = buildDexViewModel(archive, catalog, englishSettings)
        const japaneseDex = buildDexViewModel(archive, catalog, DEFAULT_VPET_SETTINGS)
        if (englishDex.kind !== "available" || japaneseDex.kind !== "available")
          throw new Error("Expected available Dex models")
        expect(englishDex.rows.find((row) => row.id === "7-001")).toEqual({
          id: "7-001",
          stage: "Ultra",
          discovered: false,
          name: "------",
        })
        expect(japaneseDex.rows.find((row) => row.id === "7-001")).toEqual({
          id: "7-001",
          stage: "SuperUltimate",
          discovered: false,
          name: "------",
        })
        expect(englishDex.rows.map((row) => row.name)).not.toContain("Set-only English")
        expect(japaneseDex.rows.map((row) => row.name)).not.toContain("Set-only Japanese")

        expect(buildHistoryViewModel(archive, catalog, DEFAULT_VPET_SETTINGS)).toEqual({
          kind: "available",
          generations: [
            {
              partnerId: "partner-zero-events",
              generation: 3,
              createdAt: "2026-07-30T12:30:00.000Z",
              retiredAt: "2026-07-30T12:31:00.000Z",
              path: [],
            },
            {
              partnerId: secondPartner.partnerId,
              generation: 2,
              createdAt: "2026-07-30T12:10:00.000Z",
              retiredAt: null,
              path: ["0-001 Egg Japanese", "99-999"],
            },
            {
              partnerId: firstPartner.partnerId,
              generation: 1,
              createdAt: "2026-07-30T12:00:00.000Z",
              retiredAt: "2026-07-30T12:10:00.000Z",
              path: ["0-001 Egg Japanese", "1-001 First Japanese", "2-001 Second Japanese"],
            },
          ],
        })
      } finally {
        closeSpy.mockRestore()
      }
    } finally {
      if (!repositoryClosed) await repository.close()
    }
  })
})
