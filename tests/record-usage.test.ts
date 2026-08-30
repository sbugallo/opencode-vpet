import { describe, expect, test } from "bun:test"

import type { DigimonNode } from "../src/data/catalog.ts"
import type { Partner, PartnerProgression } from "../src/domain/partner.ts"
import type { UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import { reconcileUsage } from "../src/application/use-cases/reconcile-usage.ts"
import { recordUsage, type CompletedUsage } from "../src/application/use-cases/record-usage.ts"
import { STAGE_GAUGE_THRESHOLDS, type StageThresholds } from "../src/domain/evolution.ts"

const currentNode: DigimonNode = {
  id: "current",
  nameEn: "Current",
  nameJp: "Current",
  nextEvolutions: ["target"],
  sprite: "current.png",
  stage: 0,
  url: "https://example.test/current",
}

const targetNode: DigimonNode = {
  id: "target",
  nameEn: "Target",
  nameJp: "Target",
  nextEvolutions: [],
  sprite: "target.png",
  stage: 1,
  url: "https://example.test/target",
}

const activePartner: Partner = {
  partnerId: "partner-1",
  generation: 1,
  currentNodeId: currentNode.id,
  gauge: 499_999,
  isTerminal: false,
  createdAt: "2026-07-31T00:00:00.000Z",
  retiredAt: null,
}

const usage = (receiptKey: string, tokenDelta = 1): CompletedUsage => ({
  receiptKey,
  eventId: `usage:${receiptKey}`,
  tokenDelta,
  cost: null,
  createdAt: "2026-07-31T00:01:00.000Z",
})

type FakeLedger = UsageLedger & {
  readonly receipts: UsageReceiptMetadata[]
  readonly evolutions: PartnerProgression[]
}

const createLedger = (outcome: "applied" | "duplicate" | "no_active_partner", partner = activePartner): FakeLedger => {
  const receipts: UsageReceiptMetadata[] = []
  const evolutions: PartnerProgression[] = []

  return {
    receipts,
    evolutions,
    applyUsageReceipt(receipt, evolve) {
      if (outcome !== "applied") return { kind: outcome }
      const evolution = evolve(partner)
      receipts.push(receipt)
      evolutions.push(evolution)
      return { kind: "applied" }
    },
  }
}

describe("record usage application use case", () => {
  test("Given completed usage and an active partner When recording it Then the ledger applies the transaction-scoped evolution", () => {
    const ledger = createLedger("applied")

    const outcome = recordUsage({
      usage: usage("receipt-1"),
      ledger,
      digimonById: new Map([
        [currentNode.id, currentNode],
        [targetNode.id, targetNode],
      ]),
      selector: () => 0,
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({
      kind: "applied",
      receiptKey: "receipt-1",
      evolution: { fromNodeId: currentNode.id, toNodeId: targetNode.id },
    })
    expect(ledger.receipts).toEqual([usage("receipt-1")])
    expect(ledger.evolutions).toEqual([
      {
        currentNodeId: targetNode.id,
        gauge: 0,
        isTerminal: true,
      },
    ])
  })

  test("Given an applied receipt without a threshold crossing When recording it Then the ledger preserves the receipt and gauge-only progression", () => {
    const ledger = createLedger("applied", { ...activePartner, gauge: 0 })

    const outcome = recordUsage({
      usage: usage("receipt-gauge-only"),
      ledger,
      digimonById: new Map([
        [currentNode.id, currentNode],
        [targetNode.id, targetNode],
      ]),
      selector: () => {
        throw new Error("selector must not run")
      },
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "applied", receiptKey: "receipt-gauge-only" })
    expect(ledger.receipts).toEqual([usage("receipt-gauge-only")])
    expect(ledger.evolutions).toEqual([
      {
        currentNodeId: currentNode.id,
        gauge: 1,
        isTerminal: false,
      },
    ])
  })

  test("Given a duplicate receipt When recording it Then the use case preserves the no-op without selecting an evolution", () => {
    const ledger = createLedger("duplicate")

    const outcome = recordUsage({
      usage: usage("receipt-duplicate"),
      ledger,
      digimonById: new Map(),
      selector: () => {
        throw new Error("selector must not run")
      },
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "duplicate", receiptKey: "receipt-duplicate" })
    expect(ledger.receipts).toEqual([])
  })

  test("Given no active partner When recording completed usage Then the use case preserves the ledger outcome", () => {
    const ledger = createLedger("no_active_partner")

    const outcome = recordUsage({
      usage: usage("receipt-no-partner"),
      ledger,
      digimonById: new Map(),
      selector: () => {
        throw new Error("selector must not run")
      },
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "no_active_partner", receiptKey: "receipt-no-partner" })
    expect(ledger.receipts).toEqual([])
  })

  test("Given frozen or cheat usage already applied by the control ledger When recording Then no evolution transition is reported", () => {
    const modes = ["frozen", "cheat"] as const

    for (const mode of modes) {
      const receivedReceipts: UsageReceiptMetadata[] = []
      const ledger: UsageLedger = {
        applyUsageReceipt(receipt) {
          receivedReceipts.push(receipt)
          return { kind: "applied" }
        },
      }

      const outcome = recordUsage({
        usage: usage(`receipt-${mode}`),
        ledger,
        digimonById: new Map(),
        selector: () => {
          throw new Error("selector must not run")
        },
        thresholds: STAGE_GAUGE_THRESHOLDS,
      })

      expect(outcome).toEqual({ kind: "applied", receiptKey: `receipt-${mode}` })
      expect(receivedReceipts).toEqual([usage(`receipt-${mode}`)])
    }
  })

  test("Given a terminal partner When recording applied usage Then no same-node terminal movement is reported as an evolution", () => {
    const ledger = createLedger("applied", {
      ...activePartner,
      currentNodeId: targetNode.id,
      gauge: 0,
      isTerminal: true,
    })

    const outcome = recordUsage({
      usage: usage("receipt-terminal"),
      ledger,
      digimonById: new Map([[targetNode.id, targetNode]]),
      selector: () => {
        throw new Error("selector must not run")
      },
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "applied", receiptKey: "receipt-terminal" })
    expect(ledger.evolutions).toEqual([
      {
        currentNodeId: targetNode.id,
        gauge: 0,
        isTerminal: true,
      },
    ])
  })

  test("Given usage in sequence including a duplicate When reconciling Then each receipt is processed in input order and the duplicate remains a no-op", () => {
    const appliedReceiptKeys: string[] = []
    const seenReceiptKeys = new Set<string>()
    const ledger: UsageLedger = {
      applyUsageReceipt(receipt) {
        appliedReceiptKeys.push(receipt.receiptKey)
        if (seenReceiptKeys.has(receipt.receiptKey)) return { kind: "duplicate" }
        seenReceiptKeys.add(receipt.receiptKey)
        return { kind: "no_active_partner" }
      },
    }

    const outcomes = reconcileUsage({
      usages: [usage("first"), usage("second"), usage("first"), usage("third")],
      ledger,
      digimonById: new Map(),
      selector: () => {
        throw new Error("selector must not run")
      },
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcomes).toEqual([
      { kind: "no_active_partner", receiptKey: "first" },
      { kind: "no_active_partner", receiptKey: "second" },
      { kind: "duplicate", receiptKey: "first" },
      { kind: "no_active_partner", receiptKey: "third" },
    ])
    expect(appliedReceiptKeys).toEqual(["first", "second", "first", "third"])
  })

  test("Given an applied receipt whose persisted partner node is absent from the supplied catalog When recording Then the existing error occurs before a ledger commit", () => {
    const ledger = createLedger("applied", { ...activePartner, currentNodeId: "missing" })

    expect(() =>
      recordUsage({
        usage: usage("receipt-missing-node"),
        ledger,
        digimonById: new Map(),
        selector: () => 0,
        thresholds: STAGE_GAUGE_THRESHOLDS,
      }),
    ).toThrow("Persisted partner node missing is missing from the catalog")
    expect(ledger.receipts).toEqual([])
  })

  test("Given a ledger write failure after a candidate evolution When recording Then it preserves the error without returning a transition", () => {
    const writeFailure = new Error("receipt write failed")
    const ledger: UsageLedger = {
      applyUsageReceipt(_receipt, evolve) {
        evolve(activePartner)
        throw writeFailure
      },
    }

    expect(() =>
      recordUsage({
        usage: usage("receipt-write-failure"),
        ledger,
        digimonById: new Map([
          [currentNode.id, currentNode],
          [targetNode.id, targetNode],
        ]),
        selector: () => 0,
        thresholds: STAGE_GAUGE_THRESHOLDS,
      }),
    ).toThrow(writeFailure)
  })

  test("Given a custom child threshold When recording usage Then the ledger evolves at the supplied threshold", () => {
    const thresholds: StageThresholds = Object.freeze({
      ...STAGE_GAUGE_THRESHOLDS,
      0: 1,
    })
    const ledger = createLedger("applied", { ...activePartner, gauge: 0 })

    const outcome = recordUsage({
      usage: usage("receipt-custom-threshold"),
      ledger,
      digimonById: new Map([
        [currentNode.id, currentNode],
        [targetNode.id, targetNode],
      ]),
      selector: () => 0,
      thresholds,
    })

    expect(outcome).toEqual({
      kind: "applied",
      receiptKey: "receipt-custom-threshold",
      evolution: { fromNodeId: currentNode.id, toNodeId: targetNode.id },
    })
    expect(ledger.evolutions).toEqual([
      {
        currentNodeId: targetNode.id,
        gauge: 0,
        isTerminal: true,
      },
    ])
  })
})
