import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { join } from "node:path"
import { Database } from "bun:sqlite"

import { openReadonlyDatabase, openWritableDatabase } from "../../src/adapters/sqlite/bun-sqlite-driver.ts"
import type { Partner } from "../../src/domain/partner.ts"
import {
  createSqliteVpetRepository,
  resolveHostDatabasePath,
} from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"
import {
  applyReceipt,
  createTempTestRoot,
  removeTempTestRoot,
  spawn,
  spawnInput,
  type TempTestRoot,
  usageReceipt,
} from "./sqlite-vpet-repository.fixtures.ts"

describe.if(isBunSqliteAvailable)("sqlite vpet repository lifecycle", () => {
  let tempRoot: TempTestRoot
  beforeEach(async () => {
    tempRoot = await createTempTestRoot()
  })
  afterEach(async () => {
    await removeTempTestRoot(tempRoot)
  })

  test("Given SQLite writer and reader handles When opened Then each applies its required pragma configuration", () => {
    const databasePath = join(tempRoot.root, "pragma.db")
    const runSpy = spyOn(Database.prototype, "run")
    const writer = openWritableDatabase(databasePath)
    const reader = openReadonlyDatabase(databasePath)
    try {
      expect(runSpy.mock.calls.map(([sql]) => sql)).toEqual([
        "PRAGMA busy_timeout = 5000",
        "PRAGMA journal_mode = WAL",
        "PRAGMA foreign_keys = ON",
        "PRAGMA busy_timeout = 5000",
        "PRAGMA foreign_keys = ON",
      ])
    } finally {
      writer.close()
      reader.close()
      runSpy.mockRestore()
    }
  })

  test("Given a temp app-data root When the repository initializes Then it creates the migrated host-wide database path", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      expect(repository.databasePath).toBe(join(tempRoot.appDataRoot, "opencode-vpet", "pet.db"))
      expect(resolveHostDatabasePath({ appDataRoot: tempRoot.appDataRoot })).toBe(repository.databasePath)
      expect(await Bun.file(repository.databasePath).exists()).toBe(true)
      expect(repository.getAppliedMigrations()).toEqual([1, 2, 3])
    } finally {
      await repository.close()
    }
  })

  test("Given application spawn and receipt contracts When SQLite persists them Then reads and transaction callbacks use canonical domain Partner state", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      const spawned: Partner = repository.spawnPartner(spawnInput())
      const callbackPartners: Partner[] = []
      const outcome = repository.applyUsageReceipt(
        usageReceipt("receipt-domain-contract", "usage-domain-contract", 100),
        (partner) => {
          callbackPartners.push(partner)
          return { currentNodeId: partner.currentNodeId, gauge: partner.gauge + 100, isTerminal: partner.isTerminal }
        },
      )
      expect(outcome).toEqual({ kind: "applied" })
      expect(callbackPartners).toEqual([spawned])
      expect(repository.getActivePartner()).toEqual({ ...spawned, gauge: 100 })
    } finally {
      await repository.close()
    }
  })

  test("Given a populated SQLite database When the repository reopens it Then migrations preserve its partner, receipt, event, and trainer state", async () => {
    const databasePath = join(tempRoot.root, "existing.db")
    const firstRepository = await createSqliteVpetRepository({ databasePath })
    const partner = spawn(firstRepository)
    expect(applyReceipt(firstRepository, "receipt-existing", "usage-existing", 100)).toEqual({ kind: "applied" })
    const expectedPartner = firstRepository.getActivePartner()
    const expectedEvents = firstRepository.listPartnerEvents(partner.partnerId)
    const expectedReceipts = firstRepository.listUsageReceipts()
    const expectedTrainer = firstRepository.getTrainerState()
    await firstRepository.close()
    const reopenedRepository = await createSqliteVpetRepository({ databasePath })
    try {
      expect(reopenedRepository.getAppliedMigrations()).toEqual([1, 2, 3])
      expect(reopenedRepository.getActivePartner()).toEqual(expectedPartner)
      expect(reopenedRepository.listPartnerEvents(partner.partnerId)).toEqual(expectedEvents)
      expect(reopenedRepository.listUsageReceipts()).toEqual(expectedReceipts)
      expect(reopenedRepository.getTrainerState()).toEqual(expectedTrainer)
    } finally {
      await reopenedRepository.close()
    }
  })

  test("Given two repositories sharing a database When distinct usage receipts arrive Then both receipts and their token totals survive", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const secondRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawn(firstRepository)
      expect(applyReceipt(firstRepository, "receipt-1", "usage-1", 100)).toEqual({ kind: "applied" })
      expect(applyReceipt(secondRepository, "receipt-2", "usage-2", 200)).toEqual({ kind: "applied" })
      expect(firstRepository.getTrainerState()).toEqual({ totalTokens: 300 })
      expect(secondRepository.listUsageReceipts().map((receipt) => receipt.receiptKey)).toEqual([
        "receipt-1",
        "receipt-2",
      ])
      expect(firstRepository.getActivePartner()?.gauge).toBe(300)
    } finally {
      await firstRepository.close()
      await secondRepository.close()
    }
  })

  test("Given two repositories sharing a database When they apply the same receipt Then exactly one transaction changes the state", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const secondRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawn(firstRepository)
      expect(applyReceipt(firstRepository, "receipt-1", "usage-1", 100)).toEqual({ kind: "applied" })
      expect(applyReceipt(secondRepository, "receipt-1", "usage-2", 999)).toEqual({ kind: "duplicate" })
      expect(firstRepository.getTrainerState()).toEqual({ totalTokens: 100 })
      expect(firstRepository.getActivePartner()?.gauge).toBe(100)
      expect(firstRepository.listUsageReceipts()).toHaveLength(1)
    } finally {
      await firstRepository.close()
      await secondRepository.close()
    }
  })

  test("Given an active generation When a replacement is spawned Then retirement, events, and the next unique generation commit atomically", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      const firstPartner = spawn(repository)
      const secondPartner = spawn(repository, "2026-07-30T12:10:00.000Z")
      expect(firstPartner).toMatchObject({ generation: 1, retiredAt: null })
      expect(secondPartner).toMatchObject({ generation: 2, retiredAt: null })
      expect(repository.getActivePartner()).toEqual(secondPartner)
      expect(repository.listPartners()).toEqual([
        expect.objectContaining({ generation: 1, retiredAt: "2026-07-30T12:10:00.000Z" }),
        secondPartner,
      ])
      expect(repository.listPartnerEvents(firstPartner.partnerId).map((event) => event.kind)).toEqual([
        "spawned",
        "retired",
      ])
      expect(repository.listPartnerEvents(secondPartner.partnerId).map((event) => event.kind)).toEqual(["spawned"])
    } finally {
      await repository.close()
    }
  })

  test("Given two repositories sharing one active partner When both spawn replacements Then generations remain unique and exactly one partner is active", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const secondRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawn(firstRepository)
      const replacements = await Promise.all([
        Promise.resolve(spawn(firstRepository, "2026-07-30T12:10:00.000Z")),
        Promise.resolve(spawn(secondRepository, "2026-07-30T12:11:00.000Z")),
      ])
      expect(replacements.map((partner) => partner.generation)).toEqual([2, 3])
      expect(firstRepository.listPartners().filter((partner) => partner.retiredAt === null)).toHaveLength(1)
      expect(firstRepository.listPartners().map((partner) => partner.generation)).toEqual([1, 2, 3])
      expect(firstRepository.listPartnerEvents("partner-1").map((event) => event.kind)).toEqual(["spawned", "retired"])
      expect(firstRepository.listPartnerEvents("partner-2").map((event) => event.kind)).toEqual(["spawned", "retired"])
      expect(firstRepository.listPartnerEvents("partner-3").map((event) => event.kind)).toEqual(["spawned"])
    } finally {
      await firstRepository.close()
      await secondRepository.close()
    }
  })
})
