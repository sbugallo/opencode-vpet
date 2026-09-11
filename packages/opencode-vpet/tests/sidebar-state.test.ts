import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Database } from "bun:sqlite"

import { createSqliteSidebarSnapshotReader } from "../src/adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteVpetRepository } from "../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "./sqlite-capability.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-vpet-sidebar-"))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("SQLite sidebar snapshot reader", () => {
  test("Given a guaranteed nonexistent database path When reading the sidebar snapshot Then it returns null", async () => {
    const root = await createTempRoot()
    const databasePath = join(root, "missing", "pet.db")

    expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toBeNull()
  })

  test("Given a valid SQLite database without VPet tables When reading the sidebar snapshot Then the no-table failure returns null", async () => {
    const root = await createTempRoot()
    const databasePath = join(root, "empty.db")
    const result = Bun.spawnSync(["sqlite3", databasePath, "VACUUM"])
    expect(result.exitCode).toBe(0)

    expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toBeNull()
  })

  test("Given an invalid database file When reading the sidebar snapshot Then the recognized database failure returns null", async () => {
    const root = await createTempRoot()
    const databasePath = join(root, "invalid.db")
    await Bun.write(databasePath, "not a sqlite database")

    expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toBeNull()
  })

  test.if(isBunSqliteAvailable)(
    "Given a populated VPet database When reading the sidebar snapshot Then it maps the active partner and trainer state",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "pet.db")
      const repository = await createSqliteVpetRepository({ databasePath })
      const closeSpy = spyOn(Database.prototype, "close")

      try {
        repository.spawnPartner({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          createdAt: "2026-07-31T12:00:00.000Z",
        })
        repository.applyUsageReceipt(
          {
            receiptKey: "receipt-1",
            eventId: "usage-1",
            tokenDelta: 100,
            cost: null,
            createdAt: "2026-07-31T12:05:00.000Z",
          },
          (partner) => ({
            currentNodeId: partner.currentNodeId,
            gauge: partner.gauge,
            isTerminal: partner.isTerminal,
          }),
        )

        expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toEqual({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          frozen: false,
          isSetOverride: false,
          trainerTotalTokens: 100,
        })
        expect(closeSpy).toHaveBeenCalledTimes(1)
      } finally {
        closeSpy.mockRestore()
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a frozen canonical partner When reading the sidebar snapshot Then it preserves the partner and projects frozen",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "control-normal.db")
      const repository = await createSqliteVpetRepository({ databasePath })

      try {
        repository.spawnPartner({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          createdAt: "2026-08-22T12:00:00.000Z",
        })
        const database = new Database(databasePath)
        database.run("UPDATE vpet_control_state SET frozen = 1, cheat_node_id = NULL WHERE control_id = 1")
        database.close()

        expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toEqual({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          frozen: true,
          isSetOverride: false,
          trainerTotalTokens: 0,
        })
      } finally {
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a cheat override with or without a canonical partner When reading the sidebar snapshot Then it projects the cheat as a terminal empty-gauge partner",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "control-cheat.db")
      const repository = await createSqliteVpetRepository({ databasePath })

      try {
        repository.spawnPartner({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          createdAt: "2026-08-22T12:00:00.000Z",
        })
        const database = new Database(databasePath)
        database.run("UPDATE trainer_state SET total_tokens = 900 WHERE trainer_id = 1")
        database.run("UPDATE vpet_control_state SET frozen = 1, cheat_node_id = '6-001' WHERE control_id = 1")
        database.close()

        expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toEqual({
          currentNodeId: "6-001",
          gauge: 0,
          isTerminal: true,
          frozen: false,
          isSetOverride: true,
          trainerTotalTokens: 900,
        })

        const withoutPartner = new Database(databasePath)
        withoutPartner.run("UPDATE partners SET retired_at = '2026-08-22T12:05:00.000Z' WHERE retired_at IS NULL")
        withoutPartner.close()

        expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toEqual({
          currentNodeId: "6-001",
          gauge: 0,
          isTerminal: true,
          frozen: false,
          isSetOverride: true,
          trainerTotalTokens: 900,
        })
      } finally {
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a cheat-only control state When reading the sidebar snapshot Then it preserves the persisted control, partner, and trainer rows",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "cheat-only-read.db")
      const repository = await createSqliteVpetRepository({ databasePath })

      try {
        repository.spawnPartner({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          createdAt: "2026-08-22T12:00:00.000Z",
        })
        const database = new Database(databasePath)
        database.run("UPDATE trainer_state SET total_tokens = 900 WHERE trainer_id = 1")
        database.run("UPDATE vpet_control_state SET frozen = 0, cheat_node_id = '6-001' WHERE control_id = 1")
        const before = {
          control: database.query("SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1").get(),
          partner: database
            .query("SELECT current_node_id, gauge, is_terminal, retired_at FROM partners WHERE retired_at IS NULL")
            .get(),
          trainer: database.query("SELECT total_tokens FROM trainer_state WHERE trainer_id = 1").get(),
        }
        database.close()

        expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toEqual({
          currentNodeId: "6-001",
          gauge: 0,
          isTerminal: true,
          frozen: false,
          isSetOverride: true,
          trainerTotalTokens: 900,
        })

        const afterDatabase = new Database(databasePath)
        const after = {
          control: afterDatabase
            .query("SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1")
            .get(),
          partner: afterDatabase
            .query("SELECT current_node_id, gauge, is_terminal, retired_at FROM partners WHERE retired_at IS NULL")
            .get(),
          trainer: afterDatabase.query("SELECT total_tokens FROM trainer_state WHERE trainer_id = 1").get(),
        }
        afterDatabase.close()

        expect(after).toEqual(before)
      } finally {
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a stale persisted cheat ID When reading the sidebar snapshot Then it preserves the override for catalog fallback without exposing the canonical partner",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "stale-cheat.db")
      const repository = await createSqliteVpetRepository({ databasePath })

      try {
        repository.spawnPartner({
          currentNodeId: "0-001",
          gauge: 42,
          isTerminal: false,
          createdAt: "2026-08-22T12:00:00.000Z",
        })
        const database = new Database(databasePath)
        database.run("UPDATE vpet_control_state SET cheat_node_id = 'stale-node' WHERE control_id = 1")
        database.close()

        expect(createSqliteSidebarSnapshotReader({ databasePath }).getSidebarSnapshot()).toEqual({
          currentNodeId: "stale-node",
          gauge: 0,
          isTerminal: true,
          frozen: false,
          isSetOverride: true,
          trainerTotalTokens: 0,
        })
        const stored = new Database(databasePath)
        expect(stored.query("SELECT cheat_node_id FROM vpet_control_state WHERE control_id = 1").get()).toEqual({
          cheat_node_id: "stale-node",
        })
        expect(stored.query("SELECT current_node_id, gauge FROM partners WHERE retired_at IS NULL").get()).toEqual({
          current_node_id: "0-001",
          gauge: 42,
        })
        stored.close()
      } finally {
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given an opened database with an unrelated query interruption When reading the sidebar snapshot Then it rethrows after closing the handle",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "interrupted-read.db")
      const result = Bun.spawnSync([
        "sqlite3",
        databasePath,
        "CREATE TABLE partners (partner_id TEXT, generation INTEGER, current_node_id TEXT, gauge INTEGER, is_terminal INTEGER, created_at TEXT, retired_at TEXT); CREATE TABLE trainer_state (trainer_id INTEGER, total_tokens INTEGER)",
      ])
      expect(result.exitCode).toBe(0)
      const querySpy = spyOn(Database.prototype, "query").mockImplementation((): never => {
        throw new Error("reader interrupted")
      })
      const closeSpy = spyOn(Database.prototype, "close")

      try {
        const reader = createSqliteSidebarSnapshotReader({ databasePath })

        expect(() => reader.getSidebarSnapshot()).toThrow("reader interrupted")
        expect(closeSpy).toHaveBeenCalledTimes(1)
      } finally {
        querySpy.mockRestore()
        closeSpy.mockRestore()
      }
    },
  )
})
