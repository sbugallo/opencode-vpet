import { describe, expect, test } from "bun:test"

import { hasStopTokens, toCompletedUsageFromStop } from "../src/adapters/cursor/cursor-stop-mapper.ts"

describe("cursor-stop-mapper", () => {
  test("detects tokens in stop payload", () => {
    expect(hasStopTokens({ input_tokens: 100, output_tokens: 50 })).toBe(true)
    expect(hasStopTokens({})).toBe(false)
  })

  test("maps stop payload to CompletedUsage", () => {
    const usage = toCompletedUsageFromStop(
      {
        generation_id: "gen-1",
        input_tokens: 1000,
        output_tokens: 200,
      },
      "2026-09-09T00:00:00.000Z",
    )

    expect(usage).toEqual({
      receiptKey: "cursor-turn:gen-1",
      eventId: "cursor-stop:gen-1",
      tokenDelta: 1200,
      cost: null,
      createdAt: "2026-09-09T00:00:00.000Z",
    })
  })
})
