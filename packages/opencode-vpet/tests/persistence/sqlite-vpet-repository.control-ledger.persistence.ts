import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { join } from "node:path"

import { openWritableDatabase } from "../../src/adapters/sqlite/bun-sqlite-driver.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"
import {
  applyReceipt,
  createTempTestRoot,
  getControlReceipts,
  removeTempTestRoot,
  setReceiptMode,
  spawn,
  type TempTestRoot,
  usageReceipt,
} from "./sqlite-vpet-repository.fixtures.ts"

describe.if(isBunSqliteAvailable)("sqlite vpet repository control ledger", () => {
  let tempRoot: TempTestRoot
  beforeEach(async () => {
    tempRoot = await createTempTestRoot()
  })
  afterEach(async () => {
    await removeTempTestRoot(tempRoot)
  })

  test("Given a cheat and frozen control state When a receipt arrives Then cheat takes precedence and only its control receipt is written", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawn(repository)
      const database = openWritableDatabase(repository.databasePath)
      database.run("UPDATE vpet_control_state SET frozen = 1, cheat_node_id = '6-001' WHERE control_id = 1")
      database.close()
      expect(
        repository.applyUsageReceipt(usageReceipt("receipt-precedence", "usage-precedence", 100), () => {
          throw new Error("Evolution must not run in cheat mode")
        }),
      ).toEqual({ kind: "applied" })
      expect(repository.listUsageReceipts()).toEqual([])
      expect(getControlReceipts(repository.databasePath)).toEqual([
        { receipt_key: "receipt-precedence", mode: "cheat" },
      ])
      expect(repository.getTrainerState()).toEqual({ totalTokens: 0 })
    } finally {
      await repository.close()
    }
  })

  test("Given a control-ledger receipt When a repository reopens and replays it Then both ledgers deduplicate it without changing trainer totals", async () => {
    const databasePath = join(tempRoot.root, "control-reopen.db")
    const firstRepository = await createSqliteVpetRepository({ databasePath })
    try {
      setReceiptMode(databasePath, "frozen")
      expect(applyReceipt(firstRepository, "receipt-reopen", "usage-reopen", 100)).toEqual({ kind: "applied" })
    } finally {
      await firstRepository.close()
    }
    const reopenedRepository = await createSqliteVpetRepository({ databasePath })
    try {
      expect(applyReceipt(reopenedRepository, "receipt-reopen", "usage-reopen-replay", 999)).toEqual({
        kind: "duplicate",
      })
      expect(reopenedRepository.getTrainerState()).toEqual({ totalTokens: 100 })
      expect(reopenedRepository.listUsageReceipts()).toEqual([])
      expect(getControlReceipts(databasePath)).toEqual([{ receipt_key: "receipt-reopen", mode: "frozen" }])
    } finally {
      await reopenedRepository.close()
    }
  })

  test("Given two repositories sharing a control-ledger receipt When both replay it Then exactly one control transaction changes trainer totals", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const secondRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      setReceiptMode(firstRepository.databasePath, "frozen")
      expect(applyReceipt(firstRepository, "receipt-control-replay", "usage-control-replay", 100)).toEqual({
        kind: "applied",
      })
      expect(applyReceipt(secondRepository, "receipt-control-replay", "usage-control-replay-duplicate", 999)).toEqual({
        kind: "duplicate",
      })
      expect(firstRepository.getTrainerState()).toEqual({ totalTokens: 100 })
      expect(getControlReceipts(firstRepository.databasePath)).toEqual([
        { receipt_key: "receipt-control-replay", mode: "frozen" },
      ])
    } finally {
      await firstRepository.close()
      await secondRepository.close()
    }
  })

  test("Given a receipt first written to the canonical ledger When control changes before replay Then the control ledger cannot apply it again", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawn(repository)
      expect(applyReceipt(repository, "receipt-cross-ledger", "usage-canonical", 100)).toEqual({ kind: "applied" })
      setReceiptMode(repository.databasePath, "frozen")
      expect(applyReceipt(repository, "receipt-cross-ledger", "usage-control-replay", 999)).toEqual({
        kind: "duplicate",
      })
      expect(repository.getTrainerState()).toEqual({ totalTokens: 100 })
      expect(repository.listUsageReceipts()).toHaveLength(1)
      expect(getControlReceipts(repository.databasePath)).toEqual([])
    } finally {
      await repository.close()
    }
  })

  test("Given frozen mode When the receipt insert fails Then the immediate transaction rolls back the trainer total and control receipt", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      setReceiptMode(repository.databasePath, "frozen")
      const database = openWritableDatabase(repository.databasePath)
      database.run(
        "CREATE TRIGGER fail_control_receipt BEFORE INSERT ON vpet_control_receipts BEGIN SELECT RAISE(FAIL, 'control receipt insert failed'); END",
      )
      database.close()
      expect(() => applyReceipt(repository, "receipt-control-failure", "usage-control-failure", 100)).toThrow(
        "control receipt insert failed",
      )
      expect(repository.getTrainerState()).toEqual({ totalTokens: 0 })
      expect(getControlReceipts(repository.databasePath)).toEqual([])
    } finally {
      await repository.close()
    }
  })
})
