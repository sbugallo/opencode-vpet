import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"

import { openReadonlyDatabase, openWritableDatabase } from "../../src/adapters/sqlite/bun-sqlite-driver.ts"
import type { UsageReceiptMetadata } from "../../src/application/models/usage.ts"
import type { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"

export type TempTestRoot = { readonly root: string; readonly appDataRoot: string }
export type Repository = Awaited<ReturnType<typeof createSqliteVpetRepository>>
export type ReceiptMode = "normal" | "frozen" | "cheat"

const SPAWNED_AT = "2026-07-30T12:00:00.000Z"

export const createTempTestRoot = async (): Promise<TempTestRoot> => {
  const root = await mkdtemp(join(process.cwd(), ".tmp-vpet-persistence-"))
  const appDataRoot = join(root, "app-data")
  await mkdir(appDataRoot, { recursive: true })
  return { root, appDataRoot }
}

export const removeTempTestRoot = (tempRoot: TempTestRoot): Promise<void> =>
  rm(tempRoot.root, { recursive: true, force: true })

export const spawnInput = (createdAt = SPAWNED_AT) => ({
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  createdAt,
})

export const spawn = (repository: Repository, createdAt = SPAWNED_AT) => repository.spawnPartner(spawnInput(createdAt))

export const usageReceipt = (receiptKey: string, eventId: string, tokenDelta: number): UsageReceiptMetadata => ({
  receiptKey,
  eventId,
  tokenDelta,
  cost: null,
  createdAt: "2026-07-30T12:05:00.000Z",
})

export const applyReceipt = (repository: Repository, receiptKey: string, eventId: string, tokenDelta: number) =>
  repository.applyUsageReceipt(usageReceipt(receiptKey, eventId, tokenDelta), (partner) => ({
    currentNodeId: partner.currentNodeId,
    gauge: partner.gauge + tokenDelta,
    isTerminal: partner.isTerminal,
  }))

export const setReceiptMode = (databasePath: string, mode: ReceiptMode): void => {
  const database = openWritableDatabase(databasePath)
  try {
    database.run("UPDATE vpet_control_state SET frozen = ?, cheat_node_id = ? WHERE control_id = 1", [
      mode === "frozen" ? 1 : 0,
      mode === "cheat" ? "6-001" : null,
    ])
  } finally {
    database.close()
  }
}

export const getControlReceipts = (
  databasePath: string,
): readonly { readonly receipt_key: string; readonly mode: "frozen" | "cheat" }[] => {
  const database = openReadonlyDatabase(databasePath)
  try {
    return database
      .query<{ readonly receipt_key: string; readonly mode: "frozen" | "cheat" }, []>(
        "SELECT receipt_key, mode FROM vpet_control_receipts ORDER BY receipt_key ASC",
      )
      .all()
  } finally {
    database.close()
  }
}
