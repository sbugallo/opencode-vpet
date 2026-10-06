import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"

import type { UsageLedger } from "@jcendal/digital-pet-core/application/ports/usage-ledger.ts"
import { recordUsage, type CompletedUsage } from "@jcendal/digital-pet-core/application/use-cases/record-usage.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS, type StageThresholds } from "@jcendal/digital-pet-core/domain/evolution.ts"

export type TempTestRoot = { readonly root: string; readonly appDataRoot: string }

export const createTempTestRoot = async (): Promise<TempTestRoot> => {
  const root = await mkdtemp(join(process.cwd(), ".tmp-cursor-digital-pet-persistence-"))
  const appDataRoot = join(root, "app-data")
  await mkdir(appDataRoot, { recursive: true })
  return { root, appDataRoot }
}

export const removeTempTestRoot = async (tempRoot: TempTestRoot): Promise<void> => {
  await rm(tempRoot.root, { recursive: true, force: true })
}

export const usageReceipt = (
  receiptKey: string,
  tokenDelta = 1,
  createdAt = "2026-09-09T12:01:00.000Z",
): CompletedUsage => ({
  receiptKey,
  eventId: `event:${receiptKey}`,
  tokenDelta,
  cost: null,
  createdAt,
})

export const applyTokenUsage = (
  ledger: UsageLedger,
  receiptKey: string,
  tokenDelta = 1,
  options: {
    readonly thresholds?: StageThresholds
    readonly selector?: () => number
    readonly createdAt?: string
  } = {},
) =>
  recordUsage({
    usage: usageReceipt(receiptKey, tokenDelta, options.createdAt),
    ledger,
    digimonById: DIGIMON_CATALOG.byId,
    catalogNodes: DIGIMON_CATALOG.nodes,
    selector: options.selector ?? (() => 0),
    thresholds: options.thresholds ?? STAGE_GAUGE_THRESHOLDS,
  })
