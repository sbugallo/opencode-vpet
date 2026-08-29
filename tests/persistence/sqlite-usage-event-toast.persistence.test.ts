import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { AssistantMessage, Event } from "@opencode-ai/sdk"

import { createServerHooks } from "../../src/adapters/opencode/create-server-hooks.ts"
import type { VpetToastPayload } from "../../src/adapters/opencode/vpet-toast.ts"
import { DIGIMON_CATALOG } from "../../src/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "../../src/domain/evolution.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"
import { createTempTestRoot, removeTempTestRoot, spawn, type TempTestRoot } from "./sqlite-vpet-repository.fixtures.ts"

const completedMessage = (id: string): AssistantMessage => ({
  id,
  sessionID: "session-toast",
  role: "assistant",
  time: { created: 1, completed: 2 },
  parentID: "parent-1",
  modelID: "model-1",
  providerID: "provider-1",
  mode: "build",
  path: { cwd: "/tmp", root: "/tmp" },
  cost: 0,
  tokens: { input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

const directEvent = (id: string): Event => ({ type: "message.updated", properties: { info: completedMessage(id) } })

const idleEvent = { type: "session.idle", properties: { sessionID: "session-toast" } } satisfies Event
const evolutionThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 })

const createHooks = (
  repository: Awaited<ReturnType<typeof createSqliteVpetRepository>>,
  delivered: VpetToastPayload[],
  messages: readonly AssistantMessage[] = [],
  notify: (payload: VpetToastPayload) => Promise<void> = async (payload) => {
    delivered.push(payload)
  },
) =>
  createServerHooks({
    repository,
    resource: { close: async () => {} },
    evolutionSelector: () => 0,
    evolutionThresholds,
    language: "en",
    loadCatalog: async () => DIGIMON_CATALOG,
    fetchMessages: async () => messages,
    notify,
  })

const dispatch = async (hooks: ReturnType<typeof createServerHooks>, event: Event): Promise<void> => {
  const handler = hooks.event
  if (handler === undefined) throw new Error("Expected usage event hook")
  await handler({ event })
}

describe.if(isBunSqliteAvailable)("sqlite usage event toast persistence", () => {
  let tempRoot: TempTestRoot

  beforeEach(async () => {
    tempRoot = await createTempTestRoot()
  })
  afterEach(async () => {
    await removeTempTestRoot(tempRoot)
  })

  test("Given a persisted evolution receipt When direct ingestion handles it Then exactly one evolution toast is delivered", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      spawn(repository)
      await dispatch(createHooks(repository, delivered), directEvent("direct-only"))

      expect(delivered).toEqual([
        expect.objectContaining({ title: "Digi-evolution", variant: "success", duration: 5_000 }),
      ])
      expect(repository.getActivePartner()).toEqual(expect.objectContaining({ currentNodeId: "1-001", gauge: 0 }))
      expect(repository.listUsageReceipts().map((receipt) => receipt.receiptKey)).toEqual(["message:direct-only"])
      expect(repository.getTrainerState()).toEqual({ totalTokens: 1 })
    } finally {
      await repository.close()
    }
  })

  test("Given an idle-only evolution When reconciliation receives it Then one toast and durable receipt are recorded", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      spawn(repository)
      await dispatch(createHooks(repository, delivered, [completedMessage("idle-only")]), idleEvent)

      expect(delivered).toHaveLength(1)
      expect(repository.getActivePartner()).toEqual(expect.objectContaining({ currentNodeId: "1-001", gauge: 0 }))
      expect(repository.listUsageReceipts().map((receipt) => receipt.receiptKey)).toEqual(["message:idle-only"])
      expect(repository.getTrainerState()).toEqual({ totalTokens: 1 })
    } finally {
      await repository.close()
    }
  })

  test("Given a direct receipt replayed by idle reconciliation When both hooks run Then SQLite suppresses the duplicate toast and state change", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      spawn(repository)
      await dispatch(createHooks(repository, delivered), directEvent("direct-then-idle"))
      const partner = repository.getActivePartner()
      const receipts = repository.listUsageReceipts()
      const trainer = repository.getTrainerState()
      await dispatch(createHooks(repository, delivered, [completedMessage("direct-then-idle")]), idleEvent)

      expect(delivered).toHaveLength(1)
      expect(repository.getActivePartner()).toEqual(partner)
      expect(repository.listUsageReceipts()).toEqual(receipts)
      expect(repository.getTrainerState()).toEqual(trainer)
    } finally {
      await repository.close()
    }
  })

  test("Given an idle receipt replayed by direct ingestion When both hooks run Then SQLite suppresses the duplicate toast and state change", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    try {
      spawn(repository)
      await dispatch(createHooks(repository, delivered, [completedMessage("idle-then-direct")]), idleEvent)
      const partner = repository.getActivePartner()
      const receipts = repository.listUsageReceipts()
      const trainer = repository.getTrainerState()
      await dispatch(createHooks(repository, delivered), directEvent("idle-then-direct"))

      expect(delivered).toHaveLength(1)
      expect(repository.getActivePartner()).toEqual(partner)
      expect(repository.listUsageReceipts()).toEqual(receipts)
      expect(repository.getTrainerState()).toEqual(trainer)
    } finally {
      await repository.close()
    }
  })

  test("Given an evolved receipt before repository reopen When idle replays it through a new hook Then persisted duplicate state prevents another toast", async () => {
    const firstRepository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    const delivered: VpetToastPayload[] = []

    spawn(firstRepository)
    await dispatch(createHooks(firstRepository, delivered), directEvent("reopen-replay"))
    const databasePath = firstRepository.databasePath
    const expectedPartner = firstRepository.getActivePartner()
    const expectedReceipts = firstRepository.listUsageReceipts()
    const expectedTrainer = firstRepository.getTrainerState()
    await firstRepository.close()

    const reopenedRepository = await createSqliteVpetRepository({ databasePath })
    try {
      await dispatch(createHooks(reopenedRepository, delivered, [completedMessage("reopen-replay")]), idleEvent)

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

    spawn(firstRepository)
    await dispatch(
      createHooks(firstRepository, delivered, [], async () => {
        attempts += 1
        throw new Error("toast transport failed")
      }),
      directEvent("notifier-failure"),
    )
    const databasePath = firstRepository.databasePath
    const expectedPartner = firstRepository.getActivePartner()
    const expectedReceipts = firstRepository.listUsageReceipts()
    const expectedTrainer = firstRepository.getTrainerState()
    await firstRepository.close()

    const reopenedRepository = await createSqliteVpetRepository({ databasePath })
    try {
      await dispatch(createHooks(reopenedRepository, delivered, [completedMessage("notifier-failure")]), idleEvent)

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
      spawn(repository)
      await dispatch(
        createHooks(repository, delivered, [
          completedMessage("ordered-first"),
          completedMessage("ordered-second"),
          completedMessage("ordered-first"),
        ]),
        idleEvent,
      )

      expect(delivered.map((payload) => payload.message)).toEqual([
        "Digiegg evolved into Argomon!",
        "Argomon evolved into Argomon!",
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
