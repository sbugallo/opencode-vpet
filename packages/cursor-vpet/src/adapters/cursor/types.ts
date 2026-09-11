export type { CompletedUsage } from "@sbugallo/vpet-core/application/use-cases/record-usage.ts"

export type UsageWatermark = {
  readonly timestampMs: number
  readonly fingerprint: string
  readonly conversationId?: string
}

export type HookEventRecord = {
  readonly receivedAt: string
  readonly hookEventName: string
  readonly payload: CursorHookPayload
}

export type CursorHookPayload = {
  readonly hook_event_name?: string
  readonly conversation_id?: string
  readonly generation_id?: string
  readonly input_tokens?: number
  readonly output_tokens?: number
  readonly cache_read_tokens?: number
  readonly cache_write_tokens?: number
  readonly status?: string
}

export type UsageApiEvent = {
  readonly timestamp: string
  readonly model: string
  readonly isTokenBasedCall?: boolean
  readonly tokenUsage?: {
    readonly inputTokens?: number
    readonly outputTokens?: number
    readonly cacheWriteTokens?: number
    readonly cacheReadTokens?: number
  }
}

export type UsageApiResponse = {
  readonly totalUsageEventsCount?: number
  readonly usageEventsDisplay?: readonly UsageApiEvent[]
}
