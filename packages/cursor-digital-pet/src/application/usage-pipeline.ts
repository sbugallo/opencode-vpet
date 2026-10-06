import type { UsageProcessingResult } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { UsageLedger } from "@jcendal/digital-pet-core/application/ports/usage-ledger.ts"

import {
  createCursorUsageEventSource,
  type CursorUsageEventSource,
} from "../adapters/cursor/cursor-usage-event-source.ts"

export type UsagePipeline = CursorUsageEventSource

export const createUsagePipeline = (
  ledger: UsageLedger,
  onApplied: (result: UsageProcessingResult) => void,
  options: { readonly settleDelayMs: number },
): UsagePipeline =>
  createCursorUsageEventSource(ledger, onApplied, {
    settleDelayMs: options.settleDelayMs,
  })
