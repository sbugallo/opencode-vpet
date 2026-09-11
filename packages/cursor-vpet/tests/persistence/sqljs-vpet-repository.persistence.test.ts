import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"

import { recordUsage } from "@sbugallo/vpet-core/application/use-cases/record-usage.ts"
import { spawnPartner } from "@sbugallo/vpet-core/application/use-cases/spawn-partner.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@sbugallo/vpet-core/domain/evolution.ts"
import {
  createSqliteSidebarSnapshotReader,
  readSidebarSnapshot,
} from "../../src/adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"

type TempTestRoot = { readonly root: string; readonly appDataRoot: string }

let tempRoot: TempTestRoot | undefined

const createTempTestRoot = async (): Promise<TempTestRoot> => {
  const root = await mkdtemp(join(process.cwd(), ".tmp-cursor-vpet-persistence-"))
  const appDataRoot = join(root, "app-data")
  await mkdir(appDataRoot, { recursive: true })
  return { root, appDataRoot }
}

beforeEach(async () => {
  tempRoot = await createTempTestRoot()
})

afterEach(async () => {
  if (tempRoot === undefined) return
  await rm(tempRoot.root, { recursive: true, force: true })
  tempRoot = undefined
})

describe("sql.js vpet repository persistence", () => {
  test("Given usage applied through the write store When reading through the snapshot reader Then it returns fresh gauge", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const reader = await createSqliteSidebarSnapshotReader({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      expect(reader.getSidebarSnapshot()?.gauge).toBe(0)

      recordUsage({
        usage: {
          receiptKey: "receipt-1",
          eventId: "event-1",
          tokenDelta: 42,
          cost: null,
          createdAt: "2026-09-09T12:01:00.000Z",
        },
        ledger: repository,
        digimonById: DIGIMON_CATALOG.byId,
        catalogNodes: DIGIMON_CATALOG.nodes,
        selector: () => 0,
        thresholds: STAGE_GAUGE_THRESHOLDS,
      })

      expect(reader.getSidebarSnapshot()?.gauge).toBe(42)
    } finally {
      repository.close()
    }
  })

  test("Given a stale in-memory repository When another instance spawns Then usage applies to the new partner", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const writer = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const staleReader = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const snapshotReader = await createSqliteSidebarSnapshotReader({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(writer, "2026-09-09T12:00:00.000Z")
      spawnPartner(writer, "2026-09-09T12:01:00.000Z")

      recordUsage({
        usage: {
          receiptKey: "receipt-cross-window",
          eventId: "event-cross-window",
          tokenDelta: 7,
          cost: null,
          createdAt: "2026-09-09T12:02:00.000Z",
        },
        ledger: staleReader,
        digimonById: DIGIMON_CATALOG.byId,
        catalogNodes: DIGIMON_CATALOG.nodes,
        selector: () => 0,
        thresholds: STAGE_GAUGE_THRESHOLDS,
      })

      expect(staleReader.getActivePartner()?.generation).toBe(2)
      expect(snapshotReader.getSidebarSnapshot()?.gauge).toBe(7)
    } finally {
      writer.close()
      staleReader.close()
    }
  })

  test("Given a spawned partner When reading the sidebar snapshot Then it returns the active partner", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      const snapshot = await readSidebarSnapshot({ appDataRoot: tempRoot.appDataRoot })
      expect(snapshot?.currentNodeId).toBe("0-001")
      expect(snapshot?.frozen).toBe(false)
    } finally {
      repository.close()
    }
  })
})
