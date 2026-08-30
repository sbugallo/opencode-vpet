import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Database } from "bun:sqlite"

import {
  createSqliteVpetArchiveReader,
  isRecoverableSqliteReadError,
  readSqliteVpetArchive,
} from "../src/adapters/sqlite/sqlite-vpet-archive-reader.ts"
import { createSqliteVpetRepository } from "../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "./sqlite-capability.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-vpet-archive-"))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("SQLite VPet archive reader", () => {
  test("Given a generic error mentioning sqlite and database When reading an archive Then it rethrows after closing", () => {
    const error = new Error("sqlite database reader interrupted")
    let closeCount = 0

    expect(() =>
      readSqliteVpetArchive(
        {
          all: (): never => {
            throw error
          },
        },
        () => {
          closeCount += 1
        },
      ),
    ).toThrow(error)
    expect(closeCount).toBe(1)
  })

  test("Given Bun's structured SQLite error shape When classifying a read error Then it is recoverable", () => {
    const sqliteFailure = Object.assign(new Error("file is not a database"), {
      name: "SQLiteError",
      errno: 26,
      code: "SQLITE_NOTADB",
      byteOffset: -1,
    })

    expect(isRecoverableSqliteReadError(sqliteFailure)).toBe(true)
  })

  test("Given a guaranteed nonexistent database path When getting an archive Then it returns empty", async () => {
    const root = await createTempRoot()
    const databasePath = join(root, "missing", "pet.db")

    expect(createSqliteVpetArchiveReader({ databasePath }).getArchive()).toEqual({ kind: "empty" })
  })

  test.if(isBunSqliteAvailable)(
    "Given an invalid database file When getting an archive Then it returns a safe unavailable result",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "invalid.db")
      await Bun.write(databasePath, "not a sqlite database")

      expect(createSqliteVpetArchiveReader({ databasePath }).getArchive()).toEqual({
        kind: "unavailable",
        message: "VPet archive is unavailable.",
      })
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a SQLite database without archive tables When getting an archive Then it returns a safe unavailable result",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "empty.db")
      const result = Bun.spawnSync(["sqlite3", databasePath, "VACUUM"])
      expect(result.exitCode).toBe(0)

      expect(createSqliteVpetArchiveReader({ databasePath }).getArchive()).toEqual({
        kind: "unavailable",
        message: "VPet archive is unavailable.",
      })
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a valid archive database with zero partners When getting an archive Then it returns empty",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "empty-archive.db")
      const repository = await createSqliteVpetRepository({ databasePath })

      try {
        expect(createSqliteVpetArchiveReader({ databasePath }).getArchive()).toEqual({ kind: "empty" })
      } finally {
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given active and retired partners including a zero-event partner When getting an archive Then it groups canonical events by partner in deterministic order",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "pet.db")
      const repository = await createSqliteVpetRepository({ databasePath })
      const database = new Database(databasePath)

      try {
        database.run(
          "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('partner-b', 2, '1-001', 0, 0, '2026-08-01T00:00:00.000Z', NULL)",
        )
        database.run(
          "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('partner-a', 1, '0-001', 0, 0, '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z')",
        )
        database.run(
          "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('partner-c', 3, '2-001', 0, 0, '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z')",
        )
        database.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES ('event-b-later', 'partner-b', 'usage_applied', '1-002', 1, 0, 1, 'receipt-b', '2026-08-01T00:01:00.000Z')",
        )
        database.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES ('event-a-z', 'partner-a', 'spawned', '0-001', 0, 0, NULL, NULL, '2026-07-01T00:00:00.000Z')",
        )
        database.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES ('event-a-a', 'partner-a', 'usage_applied', '0-002', 1, 0, 1, 'receipt-a', '2026-07-01T00:00:00.000Z')",
        )
      } finally {
        database.close()
      }

      const closeSpy = spyOn(Database.prototype, "close")
      try {
        expect(createSqliteVpetArchiveReader({ databasePath }).getArchive()).toEqual({
          kind: "available",
          partners: [
            {
              partnerId: "partner-a",
              generation: 1,
              createdAt: "2026-07-01T00:00:00.000Z",
              retiredAt: "2026-07-02T00:00:00.000Z",
              events: [
                { eventId: "event-a-a", currentNodeId: "0-002", createdAt: "2026-07-01T00:00:00.000Z" },
                { eventId: "event-a-z", currentNodeId: "0-001", createdAt: "2026-07-01T00:00:00.000Z" },
              ],
            },
            {
              partnerId: "partner-b",
              generation: 2,
              createdAt: "2026-08-01T00:00:00.000Z",
              retiredAt: null,
              events: [{ eventId: "event-b-later", currentNodeId: "1-002", createdAt: "2026-08-01T00:01:00.000Z" }],
            },
            {
              partnerId: "partner-c",
              generation: 3,
              createdAt: "2026-09-01T00:00:00.000Z",
              retiredAt: "2026-09-02T00:00:00.000Z",
              events: [],
            },
          ],
        })
        expect(closeSpy).toHaveBeenCalledTimes(1)
      } finally {
        closeSpy.mockRestore()
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a database query throws a generic sqlite-named error When getting an archive Then it rethrows after closing the read handle",
    async () => {
      const root = await createTempRoot()
      const databasePath = join(root, "interrupted-read.db")
      const repository = await createSqliteVpetRepository({ databasePath })
      const querySpy = spyOn(Database.prototype, "query").mockImplementation((): never => {
        throw new Error("sqlite database reader interrupted")
      })
      const closeSpy = spyOn(Database.prototype, "close")

      try {
        expect(() => createSqliteVpetArchiveReader({ databasePath }).getArchive()).toThrow(
          "sqlite database reader interrupted",
        )
        expect(closeSpy).toHaveBeenCalledTimes(1)
      } finally {
        querySpy.mockRestore()
        closeSpy.mockRestore()
        await repository.close()
      }
    },
  )
})
