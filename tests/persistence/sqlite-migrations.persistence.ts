import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Database } from "bun:sqlite"

import { createExecutor } from "../../src/adapters/sqlite/bun-sqlite-driver.ts"
import { runMigrations } from "../../src/adapters/sqlite/sqlite-migrations.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"

type QueryValue = string | number | null

type MigrationExecutor = {
  readonly statements: string[]
  transactionCount: number
  insideTransaction: boolean
  run: (sql: string, params?: readonly QueryValue[]) => void
  all: <TRow extends Record<string, QueryValue>>() => readonly TRow[]
  transaction: <TReturn>(operation: () => TReturn) => TReturn
}

const createMigrationExecutor = (): MigrationExecutor => ({
  statements: [],
  transactionCount: 0,
  insideTransaction: false,
  run(sql) {
    this.statements.push(sql)
  },
  all<TRow extends Record<string, QueryValue>>() {
    expect(this.insideTransaction).toBe(true)
    return [] as readonly TRow[]
  },
  transaction<TReturn>(operation: () => TReturn): TReturn {
    this.transactionCount += 1
    this.insideTransaction = true
    try {
      return operation()
    } finally {
      this.insideTransaction = false
    }
  },
})

const withDatabase = async (operation: (database: Database) => void): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "vpet-migrations-"))
  const database = new Database(join(root, "pet.db"))

  try {
    operation(database)
  } finally {
    database.close()
    await rm(root, { recursive: true, force: true })
  }
}

const createV2Database = (database: Database): void => {
  runMigrations(createExecutor(database))
  database.run("DROP TABLE vpet_control_receipts")
  database.run("DROP TABLE vpet_control_state")
  database.run("DELETE FROM schema_migrations WHERE version = 3")
}

describe("sqlite migrations", () => {
  test("Given an unmigrated database When migrations run Then inspection and all migration writes share one immediate transaction", () => {
    const executor = createMigrationExecutor()

    expect(runMigrations(executor)).toEqual([1, 2, 3])
    expect(executor.transactionCount).toBe(1)
    expect(executor.statements.filter((statement) => statement.includes("INSERT INTO schema_migrations"))).toHaveLength(
      3,
    )
  })

  test.if(isBunSqliteAvailable)(
    "Given a fresh database When migration 3 runs Then it creates one default singleton control state and a constrained disabled-mode receipt ledger",
    async () => {
      await withDatabase((database) => {
        expect(runMigrations(createExecutor(database))).toEqual([1, 2, 3])
        expect(database.query("SELECT control_id, frozen, cheat_node_id FROM vpet_control_state").all()).toEqual([
          { control_id: 1, frozen: 0, cheat_node_id: null },
        ])
        expect(() =>
          database.run("INSERT INTO vpet_control_state (control_id, frozen, cheat_node_id) VALUES (2, 0, NULL)"),
        ).toThrow()
        expect(() =>
          database.run("INSERT INTO vpet_control_state (control_id, frozen, cheat_node_id) VALUES (1, 2, NULL)"),
        ).toThrow()
        expect(() =>
          database.run(
            "INSERT INTO vpet_control_receipts (receipt_key, mode, token_delta, cost, created_at) VALUES ('invalid-mode', 'normal', 1, NULL, '2026-08-22T00:00:00.000Z')",
          ),
        ).toThrow()
        expect(database.query("PRAGMA foreign_key_list('vpet_control_receipts')").all()).toEqual([])
      })
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a populated version 2 database When migration 3 runs Then every legacy value is preserved",
    async () => {
      await withDatabase((database) => {
        createV2Database(database)
        database.run("UPDATE trainer_state SET total_tokens = 42 WHERE trainer_id = 1")
        database.run(
          "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('partner-v2', 1, '0-001', 7, 0, '2026-08-22T00:00:00.000Z', NULL)",
        )
        database.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES ('event-v2', 'partner-v2', 'spawned', '0-001', 7, 0, NULL, NULL, '2026-08-22T00:00:00.000Z')",
        )
        database.run(
          "INSERT INTO usage_receipts (receipt_key, partner_id, event_id, token_delta, cost, created_at) VALUES ('receipt-v2', 'partner-v2', 'event-v2', 7, 1.5, '2026-08-22T00:00:00.000Z')",
        )
        const legacyTables = ["trainer_state", "partners", "partner_events", "usage_receipts"]
        const legacyRows = legacyTables.map((table) => database.query(`SELECT * FROM ${table}`).all())

        expect(runMigrations(createExecutor(database))).toEqual([1, 2, 3])
        expect(legacyTables.map((table) => database.query(`SELECT * FROM ${table}`).all())).toEqual(legacyRows)
      })
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given migration 3 fails while creating its ledger When the transaction rolls back Then neither its version nor control tables remain",
    async () => {
      await withDatabase((database) => {
        createV2Database(database)
        const executor = createExecutor(database)
        const failingExecutor = {
          ...executor,
          run(sql: string, params: readonly QueryValue[] = []) {
            if (sql.includes("CREATE TABLE IF NOT EXISTS vpet_control_receipts")) {
              throw new Error("injected migration 3 failure")
            }
            executor.run(sql, params)
          },
        }

        expect(() => runMigrations(failingExecutor)).toThrow("injected migration 3 failure")
        expect(database.query("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([
          { version: 1 },
          { version: 2 },
        ])
        expect(
          database
            .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'vpet_control_%' ORDER BY name")
            .all(),
        ).toEqual([])
      })
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a migrated database When migration 3 reruns or two writers open it Then it retains exactly one default control row",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "vpet-migrations-"))
      const databasePath = join(root, "pet.db")
      const first = new Database(databasePath)
      const second = new Database(databasePath)

      try {
        expect(runMigrations(createExecutor(first))).toEqual([1, 2, 3])
        expect(runMigrations(createExecutor(first))).toEqual([1, 2, 3])
        expect(runMigrations(createExecutor(second))).toEqual([1, 2, 3])
        expect(first.query("SELECT control_id, frozen, cheat_node_id FROM vpet_control_state").all()).toEqual([
          { control_id: 1, frozen: 0, cheat_node_id: null },
        ])
      } finally {
        first.close()
        second.close()
        await rm(root, { recursive: true, force: true })
      }
    },
  )
})
