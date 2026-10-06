import { describe, expect, test } from "bun:test"

import type { DigimonNode } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { Partner } from "@jcendal/digital-pet-core/domain/partner.ts"
import type { UsageReceiptMetadata } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { UsageLedger } from "@jcendal/digital-pet-core/application/ports/usage-ledger.ts"
import { recordUsage, type CompletedUsage } from "@jcendal/digital-pet-core/application/use-cases/record-usage.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"

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

const catalogNodes = [currentNode, targetNode]

const activePartner: Partner = {
  partnerId: "partner-1",
  generation: 1,
  currentNodeId: currentNode.id,
  gauge: 4_999_999,
  isTerminal: false,
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
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
  readonly evolutions: Array<{
    currentNodeId: string
    gauge: number
    isTerminal: boolean
    pendingEvolutionTargetId: string | null
    battleOpponentNodeId: string | null
  }>
}

const createLedger = (outcome: "applied" | "duplicate" | "no_active_partner", partner = activePartner): FakeLedger => {
  const receipts: UsageReceiptMetadata[] = []
  const evolutions: FakeLedger["evolutions"] = []

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
  test("Given completed usage and an active Digitama When recording it Then the ledger evolves immediately", () => {
    const ledger = createLedger("applied")

    const outcome = recordUsage({
      usage: usage("receipt-1"),
      ledger,
      digimonById: new Map([
        [currentNode.id, currentNode],
        [targetNode.id, targetNode],
      ]),
      catalogNodes,
      selector: () => 0,
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({
      kind: "applied",
      receiptKey: "receipt-1",
      evolution: { fromNodeId: currentNode.id, toNodeId: targetNode.id },
    })
    expect(ledger.evolutions).toEqual([
      {
        currentNodeId: targetNode.id,
        gauge: 0,
        isTerminal: true,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
    ])
  })

  test("Given an applied receipt without a threshold crossing When recording it Then only the gauge progresses", () => {
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
      catalogNodes,
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "applied", receiptKey: "receipt-gauge-only" })
    expect(ledger.evolutions).toEqual([
      {
        currentNodeId: currentNode.id,
        gauge: 1,
        isTerminal: false,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
    ])
  })

  test("Given a duplicate receipt When recording it Then the use case is a no-op", () => {
    const ledger = createLedger("duplicate")

    const outcome = recordUsage({
      usage: usage("receipt-duplicate"),
      ledger,
      digimonById: new Map(),
      selector: () => {
        throw new Error("selector must not run")
      },
      catalogNodes,
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "duplicate", receiptKey: "receipt-duplicate" })
    expect(ledger.receipts).toEqual([])
  })

  test("Given no active partner When recording completed usage Then the ledger outcome is preserved", () => {
    const ledger = createLedger("no_active_partner")

    const outcome = recordUsage({
      usage: usage("receipt-no-partner"),
      ledger,
      digimonById: new Map(),
      selector: () => {
        throw new Error("selector must not run")
      },
      catalogNodes,
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })

    expect(outcome).toEqual({ kind: "no_active_partner", receiptKey: "receipt-no-partner" })
  })
})
