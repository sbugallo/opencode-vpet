import { describe, expect, test } from "bun:test"

import {
  fingerprintEvent,
  hasValidTokens,
  isNewEvent,
  sumTokenDelta,
} from "../src/adapters/cursor/cursor-api-watermark.ts"
import type { UsageApiEvent, UsageWatermark } from "../src/adapters/cursor/types.ts"

describe("cursor-api-watermark", () => {
  const event: UsageApiEvent = {
    timestamp: "1000",
    model: "composer-2",
    isTokenBasedCall: true,
    tokenUsage: {
      inputTokens: 10,
      outputTokens: 5,
      cacheWriteTokens: 2,
      cacheReadTokens: 3,
    },
  }

  test("sums token fields", () => {
    expect(sumTokenDelta([event])).toBe(20)
  })

  test("filters new events by watermark", () => {
    const watermark: UsageWatermark = {
      timestampMs: 1000,
      fingerprint: fingerprintEvent(event),
    }
    expect(isNewEvent(event, watermark)).toBe(false)
    expect(isNewEvent({ ...event, timestamp: "1001" }, watermark)).toBe(true)
  })

  test("validates token based events", () => {
    expect(hasValidTokens(event)).toBe(true)
    expect(hasValidTokens({ timestamp: "1", model: "x" })).toBe(false)
  })
})
