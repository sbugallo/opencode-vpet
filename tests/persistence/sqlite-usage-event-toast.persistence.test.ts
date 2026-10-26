import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { setupVpetServer } from "../../src/adapters/opencode/server-plugin.ts"
import type { VpetToastPayload } from "../../src/adapters/opencode/vpet-toast.ts"
import { DEFAULT_VPET_SETTINGS } from "../../src/config/defaults.ts"
import { DIGIMON_CATALOG } from "../../src/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "../../src/domain/evolution.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"
import { createServerContextFixture } from "../server-context-fixture.ts"
import {
  createTempTestRoot,
  removeTempTestRoot,
  spawnInput,
  type TempTestRoot,
} from "./sqlite-vpet-repository.fixtures.ts"

const completedMessage = (id: string) => ({
  id,
  type: "assistant",
  time: { created: 1, completed: 2 },
  tokens: { input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

const idleEvent = { type: "session.idle", data: { sessionID: "session-toast" } }
const evolutionThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 })

const dispatchIdle = async (
  repository: Awaited<ReturnType<typeof createSqliteVpetRepository>>,
  delivered: VpetToastPayload[],
  messages: readonly unknown[] = [],
  notify: (payload: VpetToastPayload) => Promise<void> = async (payload) => {
    delivered.push(payload)
  },
): Promise<void> => {
  const fixture = createServerContextFixture()
  const cleanup = await setupVpetServer(fixture.context, {
    openRepository: async () => ({ ...repository, close: async () => {} }),
    loadSettings: async () => DEFAULT_VPET_SETTINGS,
    evolutionSelector: () => 0,
    evolutionThresholds,
    language: "en",
    loadCatalog: async () => DIGIMON_CATALOG,
    fetchMessages: async () => messages,
    notify,
  })

  await fixture.dispatch(idleEvent)
  await cleanup()
}

describe.if(isBunSqliteAvailable)("sqlite usage event toast persistence", () => {
  let tempRoot: TempTestRoot

  beforeEach(async () => {
    tempRoot = await createTempTestRoot()
  })
  afterEach(async () => {
    await removeTempTestRoot(tempRoot)
  })

  test("Given an unprocessed evolution receipt When reconciliation handles it Then exactly one evolution toast is delivered", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      repository.spawnPartner({ ...spawnInput(), currentNodeId: "D-001" })
      await dispatchIdle(repository, delivered, [completedMessage("idle-only")])

      expect(delivered).toEqual([
        expect.objectContaining({ title: "Digi-evolution", variant: "success", duration: 5_000 }),
      ])
      expect(repository.getActivePartner()).toEqual(expect.objectContaining({ currentNodeId: "BI-010", gauge: 0 }))
      expect(repository.listUsageReceipts().map((receipt) => receipt.receiptKey)).toEqual(["message:idle-only"])
      expect(repository.getTrainerState()).toEqual({ totalTokens: 1 })
    } finally {
      await repository.close()
    }
  })

  test("Given an evolved receipt replayed by a second idle When reconciliation processes it Then SQLite suppresses the duplicate toast and state change", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      repository.spawnPartner({ ...spawnInput(), currentNodeId: "D-001" })
      await dispatchIdle(repository, delivered, [completedMessage("idle-replay")])
      const partner = repository.getActivePartner()
      const receipts = repository.listUsageReceipts()
      const trainer = repository.getTrainerState()
      await dispatchIdle(repository, delivered, [completedMessage("idle-replay")])

      expect(delivered).toHaveLength(1)
      expect(repository.getActivePartner()).toEqual(partner)
      expect(repository.listUsageReceipts()).toEqual(receipts)
      expect(repository.getTrainerState()).toEqual(trainer)
    } finally {
      await repository.close()
    }
  })

  test("Given an evolved receipt before repository reopen When idle replays it through a new plugin Then persisted duplicate state prevents another toast", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    firstRepository.spawnPartner({ ...spawnInput(), currentNodeId: "D-001" })
    await dispatchIdle(firstRepository, delivered, [completedMessage("reopen-replay")])
    const databasePath = firstRepository.databasePath
    const expectedPartner = firstRepository.getActivePartner()
    const expectedReceipts = firstRepository.listUsageReceipts()
    const expectedTrainer = firstRepository.getTrainerState()
    await firstRepository.close()

    const reopenedRepository = await createSqliteVpetRepository({ databasePath })
    try {
      await dispatchIdle(reopenedRepository, delivered, [completedMessage("reopen-replay")])

      expect(delivered).toHaveLength(1)
      expect(reopenedRepository.getActivePartner()).toEqual(expectedPartner)
      expect(reopenedRepository.listUsageReceipts()).toEqual(expectedReceipts)
      expect(reopenedRepository.getTrainerState()).toEqual(expectedTrainer)
    } finally {
      await reopenedRepository.close()
    }
  })

  test("Given a notifier rejection after an evolution commits When the receipt replays after reopen Then the durable duplicate prevents retry and a second toast", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []
    let attempts = 0

    firstRepository.spawnPartner({ ...spawnInput(), currentNodeId: "D-001" })
    await dispatchIdle(firstRepository, delivered, [completedMessage("notifier-failure")], async () => {
      attempts += 1
      throw new Error("toast transport failed")
    })
    const databasePath = firstRepository.databasePath
    const expectedPartner = firstRepository.getActivePartner()
    const expectedReceipts = firstRepository.listUsageReceipts()
    const expectedTrainer = firstRepository.getTrainerState()
    await firstRepository.close()

    const reopenedRepository = await createSqliteVpetRepository({ databasePath })
    try {
      await dispatchIdle(reopenedRepository, delivered, [completedMessage("notifier-failure")])

      expect(attempts).toBe(1)
      expect(delivered).toEqual([])
      expect(reopenedRepository.getActivePartner()).toEqual(expectedPartner)
      expect(reopenedRepository.listUsageReceipts()).toEqual(expectedReceipts)
      expect(reopenedRepository.getTrainerState()).toEqual(expectedTrainer)
    } finally {
      await reopenedRepository.close()
    }
  })

  test("Given two new completed messages and one replay in idle order When reconciliation processes them Then it emits only new evolutions in message order", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      repository.spawnPartner({ ...spawnInput(), currentNodeId: "D-001" })
      await dispatchIdle(repository, delivered, [
        completedMessage("ordered-first"),
        completedMessage("ordered-second"),
        completedMessage("ordered-first"),
      ])

      expect(delivered.map((payload) => payload.message)).toEqual([
        "Digiegg (Deep Savers) evolved into Cotsucomon!",
        "Cotsucomon evolved into Kakkinmon!",
      ])
      expect(repository.listUsageReceipts().map((receipt) => receipt.receiptKey)).toEqual([
        "message:ordered-first",
        "message:ordered-second",
      ])
      expect(repository.getTrainerState()).toEqual({ totalTokens: 2 })
    } finally {
      await repository.close()
    }
  })
})
