import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"
import {
  applyReceipt,
  createTempTestRoot,
  getControlReceipts,
  removeTempTestRoot,
  setReceiptMode,
  spawn,
  type ReceiptMode,
  type TempTestRoot,
  usageReceipt,
} from "./sqlite-vpet-repository.fixtures.ts"

type ReceiptMatrixCase = {
  readonly mode: ReceiptMode
  readonly hasActivePartner: boolean
  readonly duplicate: boolean
  readonly expectedOutcome: "applied" | "duplicate" | "no_active_partner"
  readonly expectedCanonicalReceipts: number
  readonly expectedControlReceipts: number
  readonly expectedTrainerTotal: number
  readonly expectedEvolutionCalls: number
}

const receiptMatrixCases: ReceiptMatrixCase[] = [
  {
    mode: "normal",
    hasActivePartner: true,
    duplicate: false,
    expectedOutcome: "applied",
    expectedCanonicalReceipts: 1,
    expectedControlReceipts: 0,
    expectedTrainerTotal: 100,
    expectedEvolutionCalls: 1,
  },
  {
    mode: "normal",
    hasActivePartner: true,
    duplicate: true,
    expectedOutcome: "duplicate",
    expectedCanonicalReceipts: 1,
    expectedControlReceipts: 0,
    expectedTrainerTotal: 100,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "normal",
    hasActivePartner: false,
    duplicate: false,
    expectedOutcome: "no_active_partner",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 0,
    expectedTrainerTotal: 0,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "normal",
    hasActivePartner: false,
    duplicate: true,
    expectedOutcome: "no_active_partner",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 0,
    expectedTrainerTotal: 0,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "frozen",
    hasActivePartner: true,
    duplicate: false,
    expectedOutcome: "applied",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 100,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "frozen",
    hasActivePartner: true,
    duplicate: true,
    expectedOutcome: "duplicate",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 100,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "frozen",
    hasActivePartner: false,
    duplicate: false,
    expectedOutcome: "applied",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 100,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "frozen",
    hasActivePartner: false,
    duplicate: true,
    expectedOutcome: "duplicate",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 100,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "cheat",
    hasActivePartner: true,
    duplicate: false,
    expectedOutcome: "applied",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 0,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "cheat",
    hasActivePartner: true,
    duplicate: true,
    expectedOutcome: "duplicate",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 0,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "cheat",
    hasActivePartner: false,
    duplicate: false,
    expectedOutcome: "applied",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 0,
    expectedEvolutionCalls: 0,
  },
  {
    mode: "cheat",
    hasActivePartner: false,
    duplicate: true,
    expectedOutcome: "duplicate",
    expectedCanonicalReceipts: 0,
    expectedControlReceipts: 1,
    expectedTrainerTotal: 0,
    expectedEvolutionCalls: 0,
  },
]

describe.if(isBunSqliteAvailable)("sqlite vpet repository receipts", () => {
  let tempRoot: TempTestRoot
  beforeEach(async () => {
    tempRoot = await createTempTestRoot()
  })
  afterEach(async () => {
    await removeTempTestRoot(tempRoot)
  })

  test.each(receiptMatrixCases)(
    "Given $mode control with an active partner=$hasActivePartner and duplicate=$duplicate When a receipt arrives Then it applies the mode-specific ledger outcome",
    async ({
      mode,
      hasActivePartner,
      duplicate,
      expectedOutcome,
      expectedCanonicalReceipts,
      expectedControlReceipts,
      expectedTrainerTotal,
      expectedEvolutionCalls,
    }) => {
      const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
      let evolutionCalls = 0
      try {
        if (hasActivePartner) spawn(repository)
        setReceiptMode(repository.databasePath, mode)
        const receipt = usageReceipt("receipt-matrix", "usage-matrix", 100)
        if (duplicate && (hasActivePartner || mode !== "normal"))
          expect(
            repository.applyUsageReceipt(receipt, (partner) => ({
              currentNodeId: partner.currentNodeId,
              gauge: partner.gauge + receipt.tokenDelta,
              isTerminal: partner.isTerminal,
            })),
          ).toEqual({ kind: "applied" })
        const outcome = repository.applyUsageReceipt(receipt, (partner) => {
          evolutionCalls += 1
          return {
            currentNodeId: partner.currentNodeId,
            gauge: partner.gauge + receipt.tokenDelta,
            isTerminal: partner.isTerminal,
          }
        })
        expect(outcome).toEqual({ kind: expectedOutcome })
        expect(repository.listUsageReceipts()).toHaveLength(expectedCanonicalReceipts)
        expect(getControlReceipts(repository.databasePath)).toHaveLength(expectedControlReceipts)
        expect(repository.getTrainerState()).toEqual({ totalTokens: expectedTrainerTotal })
        expect(evolutionCalls).toBe(expectedEvolutionCalls)
      } finally {
        await repository.close()
      }
    },
  )

  test("Given no active partner When a receipt arrives Then no receipt or trainer state is written", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      expect(applyReceipt(repository, "receipt-1", "usage-1", 100)).toEqual({ kind: "no_active_partner" })
      expect(repository.getTrainerState()).toEqual({ totalTokens: 0 })
      expect(repository.listUsageReceipts()).toEqual([])
    } finally {
      await repository.close()
    }
  })

  test("Given an active partner When the evolution callback throws Then the partner, trainer, events, and receipts remain unchanged", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      const partner = spawn(repository)
      const baselinePartner = repository.getActivePartner()
      const baselineTrainer = repository.getTrainerState()
      const baselineEvents = repository.listPartnerEvents(partner.partnerId)
      const baselineReceipts = repository.listUsageReceipts()
      const callbackFailure = new Error("evolution callback failed")
      expect(() =>
        repository.applyUsageReceipt(
          {
            receiptKey: "receipt-throws",
            eventId: "usage-throws",
            tokenDelta: 100,
            cost: 1.25,
            createdAt: "2026-07-30T12:05:00.000Z",
          },
          () => {
            throw callbackFailure
          },
        ),
      ).toThrow(callbackFailure)
      expect(repository.getActivePartner()).toEqual(baselinePartner)
      expect(repository.getTrainerState()).toEqual(baselineTrainer)
      expect(repository.listPartnerEvents(partner.partnerId)).toEqual(baselineEvents)
      expect(repository.listUsageReceipts()).toEqual(baselineReceipts)
      expect(getControlReceipts(repository.databasePath)).toEqual([])
    } finally {
      await repository.close()
    }
  })
})
