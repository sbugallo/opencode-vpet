import type { CompletedUsage } from "@sbugallo/vpet-core/application/use-cases/record-usage.ts"

import { CURSOR_USAGE_EVENTS_URL } from "../../shared/constants/cursor.ts"
import { sleep } from "../../shared/sleep.ts"
import { readCursorAccessToken } from "./cursor-auth.ts"
import type { UsageApiEvent, UsageApiResponse, UsageWatermark } from "./types.ts"

export const fingerprintEvent = (event: UsageApiEvent | undefined): string => {
  if (event === undefined) return "none"
  const tokens = event.tokenUsage
  return `${event.timestamp}:${event.model}:${tokens?.inputTokens ?? 0}:${tokens?.outputTokens ?? 0}`
}

export const hasValidTokens = (event: UsageApiEvent): boolean => {
  if (!event.isTokenBasedCall || event.tokenUsage === undefined) return false
  const { inputTokens = 0, outputTokens = 0, cacheWriteTokens = 0, cacheReadTokens = 0 } = event.tokenUsage
  return inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens > 0
}

export const sumTokenDelta = (events: readonly UsageApiEvent[]): number =>
  events.reduce((sum, event) => {
    const tokens = event.tokenUsage
    if (tokens === undefined) return sum
    return (
      sum +
      (tokens.inputTokens ?? 0) +
      (tokens.outputTokens ?? 0) +
      (tokens.cacheWriteTokens ?? 0) +
      (tokens.cacheReadTokens ?? 0)
    )
  }, 0)

export const isNewEvent = (event: UsageApiEvent, watermark: UsageWatermark): boolean => {
  const timestampMs = Number(event.timestamp)
  if (timestampMs < watermark.timestampMs) return false
  if (timestampMs === watermark.timestampMs && fingerprintEvent(event) === watermark.fingerprint) return false
  return hasValidTokens(event)
}

const fetchUsagePage = async (
  accessToken: string,
  body: Record<string, string | number>,
): Promise<UsageApiResponse> => {
  const response = await fetch(CURSOR_USAGE_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Origin: "https://cursor.com",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Usage API failed: ${response.status}`)
  }

  return (await response.json()) as UsageApiResponse
}

export const captureWatermark = async (): Promise<UsageWatermark> => {
  const accessToken = await readCursorAccessToken()
  if (accessToken === null) {
    return { timestampMs: Date.now(), fingerprint: "none" }
  }

  const response = await fetchUsagePage(accessToken, { page: 1, pageSize: 1 })
  const latest = response.usageEventsDisplay?.find(hasValidTokens)
  if (latest === undefined) {
    return { timestampMs: Date.now(), fingerprint: "none" }
  }

  return {
    timestampMs: Number(latest.timestamp),
    fingerprint: fingerprintEvent(latest),
  }
}

export const fetchNewEventsSince = async (
  watermark: UsageWatermark,
  endDateMs: number,
): Promise<readonly UsageApiEvent[]> => {
  const accessToken = await readCursorAccessToken()
  if (accessToken === null) return []

  const collected: UsageApiEvent[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const response = await fetchUsagePage(accessToken, {
      startDate: String(watermark.timestampMs),
      endDate: String(endDateMs),
      page,
      pageSize,
    })

    const events = response.usageEventsDisplay ?? []
    for (const event of events) {
      if (isNewEvent(event, watermark)) collected.push(event)
    }

    const total = response.totalUsageEventsCount ?? 0
    if (page * pageSize >= total || events.length === 0) break
    page += 1
  }

  return collected.sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
}

export type SettleOptions = {
  readonly initialDelayMs: number
  readonly retryDelaysMs: readonly number[]
}

export const settleTurnDelta = async (
  watermark: UsageWatermark,
  generationId: string,
  options: SettleOptions,
): Promise<CompletedUsage | null> => {
  const delays = [options.initialDelayMs, ...options.retryDelaysMs]

  for (const delayMs of delays) {
    await sleep(delayMs)
    const endDateMs = Date.now()
    const newEvents = await fetchNewEventsSince(watermark, endDateMs)
    if (newEvents.length === 0) continue

    const tokenDelta = sumTokenDelta(newEvents)
    if (tokenDelta <= 0) continue

    return {
      receiptKey: `cursor-turn:${generationId}`,
      eventId: `cursor-api-delta:${generationId}`,
      tokenDelta,
      cost: null,
      createdAt: new Date().toISOString(),
    }
  }

  return null
}
