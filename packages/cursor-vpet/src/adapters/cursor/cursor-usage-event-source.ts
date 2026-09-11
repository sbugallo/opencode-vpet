import { watch } from "node:fs"
import { open, stat, writeFile } from "node:fs/promises"

import type { UsageProcessingResult } from "@sbugallo/vpet-core/application/models/usage.ts"
import type { UsageLedger } from "@sbugallo/vpet-core/application/ports/usage-ledger.ts"
import { recordUsage } from "@sbugallo/vpet-core/application/use-cases/record-usage.ts"
import type { CompletedUsage } from "@sbugallo/vpet-core/application/use-cases/record-usage.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@sbugallo/vpet-core/domain/evolution.ts"

import { captureWatermark, settleTurnDelta } from "./cursor-api-watermark.ts"
import { hasStopTokens, toCompletedUsageFromStop } from "./cursor-stop-mapper.ts"
import { resolveHookEventsPath } from "./paths.ts"
import type { HookEventRecord, UsageWatermark } from "./types.ts"

type TurnState = {
  watermark: UsageWatermark
}

export type CursorUsageSettleOptions = {
  readonly settleDelayMs: number
}

export type CursorUsageEventSource = {
  dispose(): void
}

const toSettleOptions = (options: CursorUsageSettleOptions) => ({
  initialDelayMs: options.settleDelayMs,
  retryDelaysMs: [Math.max(options.settleDelayMs + 2000, 6000), Math.max(options.settleDelayMs + 6000, 10000)],
})

export const createCursorUsageEventSource = (
  ledger: UsageLedger,
  onApplied?: (result: UsageProcessingResult) => void,
  options: CursorUsageSettleOptions & { readonly eventsPath?: string } = { settleDelayMs: 4000 },
): CursorUsageEventSource => {
  const eventsPath = options.eventsPath ?? resolveHookEventsPath()
  const settleOptions = toSettleOptions(options)
  const pendingWatermarks = new Map<string, TurnState>()
  const processedReceipts = new Set<string>()
  let disposed = false
  let watcher: ReturnType<typeof watch> | undefined

  const applyUsage = async (usage: CompletedUsage, source: string): Promise<void> => {
    if (processedReceipts.has(usage.receiptKey)) return
    processedReceipts.add(usage.receiptKey)
    const result = recordUsage({
      ledger,
      usage,
      digimonById: DIGIMON_CATALOG.byId,
      catalogNodes: DIGIMON_CATALOG.nodes,
      selector: Math.random,
      thresholds: STAGE_GAUGE_THRESHOLDS,
    })
    console.log(`[cursor-vpet] ${source}`, result)
    if (result.kind === "applied") onApplied?.(result)
  }

  const handleBeforeSubmit = async (record: HookEventRecord): Promise<void> => {
    const conversationId = record.payload.conversation_id
    const watermark = await captureWatermark()
    const key = conversationId ?? `turn:${record.receivedAt}`
    pendingWatermarks.set(key, { watermark })
  }

  const handleStop = async (record: HookEventRecord): Promise<void> => {
    const conversationId = record.payload.conversation_id
    const generationId = record.payload.generation_id ?? conversationId
    if (generationId === undefined) return

    if (hasStopTokens(record.payload)) {
      const usage = toCompletedUsageFromStop(record.payload, record.receivedAt)
      if (usage !== null) {
        await applyUsage(usage, "hook-stop")
        pendingWatermarks.delete(conversationId ?? generationId)
        return
      }
    }

    const key = conversationId ?? generationId
    const state = pendingWatermarks.get(key)
    pendingWatermarks.delete(key)
    const usage = await settleTurnDelta(
      state?.watermark ?? { timestampMs: 0, fingerprint: "none" },
      generationId,
      settleOptions,
    )
    if (usage !== null) {
      await applyUsage(usage, "api-watermark")
    }
  }

  const processLine = async (line: string): Promise<void> => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return
    let record: HookEventRecord
    try {
      record = JSON.parse(trimmed) as HookEventRecord
    } catch {
      return
    }
    const eventName = record.hookEventName ?? record.payload.hook_event_name
    if (eventName === "beforeSubmitPrompt") await handleBeforeSubmit(record)
    if (eventName === "stop") await handleStop(record)
  }

  const startWatch = async (): Promise<void> => {
    let offset = 0
    try {
      const fileStat = await stat(eventsPath)
      offset = fileStat.size
    } catch {
      await writeFile(eventsPath, "", "utf8")
    }

    watcher = watch(eventsPath, async () => {
      if (disposed) return
      try {
        const fileStat = await stat(eventsPath)
        if (fileStat.size <= offset) return
        const handle = await open(eventsPath, "r")
        const length = fileStat.size - offset
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, offset)
        await handle.close()
        offset = fileStat.size
        for (const line of buffer.toString("utf8").split("\n")) {
          await processLine(line)
        }
      } catch (error) {
        console.error("[cursor-vpet] hook watch error", error)
      }
    })
  }

  void startWatch()

  return {
    dispose() {
      disposed = true
      watcher?.close()
    },
  }
}
