import { describe, expect, test } from "bun:test"

import { toCompletedUsageFromMessage } from "../src/adapters/opencode/usage-event-mapper.ts"
import { createSessionMessagesFetcher } from "../src/adapters/opencode/session-messages.ts"
import { setupVpetServer } from "../src/adapters/opencode/server-plugin.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { PartnerLifecycle } from "../src/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import type { VpetControl } from "../src/application/ports/vpet-control.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { createServerContextFixture } from "./server-context-fixture.ts"

const completedAssistantMessage = (id: string, tokenDelta = 150) => ({
  id,
  type: "assistant",
  time: { created: 1, completed: 2 },
  tokens: { input: tokenDelta, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  cost: 0,
})

const incompleteAssistantMessage = {
  ...completedAssistantMessage("incomplete-message"),
  time: { created: 1 },
}

const userMessage = {
  id: "user-message",
  type: "user",
  time: { created: 1 },
}

describe("usage event ingestion", () => {
  test("Given a completed assistant message When extracting its receipt Then every token category is aggregated under the message id", () => {
    const message = {
      id: "message-1",
      type: "assistant",
      time: { created: 1, completed: 2 },
      tokens: { input: 10, output: 20, reasoning: 30, cache: { read: 40, write: 50 } },
    }

    expect(toCompletedUsageFromMessage(message)).toEqual({
      receiptKey: "message:message-1",
      eventId: "usage:message-1",
      tokenDelta: 150,
      cost: null,
      createdAt: "1970-01-01T00:00:00.002Z",
    })
  })

  test("Given non-completed, non-assistant, or missing-id messages When extracting their receipts Then they are ignored", () => {
    expect(toCompletedUsageFromMessage(incompleteAssistantMessage)).toBeNull()
    expect(toCompletedUsageFromMessage(userMessage)).toBeNull()
    expect(toCompletedUsageFromMessage({ ...completedAssistantMessage("no-tokens"), tokens: undefined })).toBeNull()
    expect(toCompletedUsageFromMessage({ ...completedAssistantMessage("empty-id"), id: "" })).toBeNull()
    expect(toCompletedUsageFromMessage(undefined)).toBeNull()
  })

  test("Given a completed assistant message with non-positive or non-finite costs When extracting its receipt Then cost is normalized to null without changing stable ids", () => {
    const invalidCosts = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

    for (const cost of invalidCosts) {
      const message = {
        ...completedAssistantMessage(`message-cost-${String(cost)}`),
        cost,
      }
      const receipt = toCompletedUsageFromMessage(message)

      expect(receipt).toEqual(
        expect.objectContaining({
          receiptKey: `message:${message.id}`,
          eventId: `usage:${message.id}`,
          cost: null,
        }),
      )
    }
  })

  test("Given a completed assistant message with a positive finite cost When extracting its receipt Then the cost and message-derived ids are preserved", () => {
    const message = {
      ...completedAssistantMessage("message-priced"),
      cost: 1.25,
    }

    expect(toCompletedUsageFromMessage(message)).toEqual(
      expect.objectContaining({
        receiptKey: "message:message-priced",
        eventId: "usage:message-priced",
        cost: 1.25,
      }),
    )
  })

  test("Given session context messages When translating them Then completed assistant usages are kept and incomplete and user messages are filtered", () => {
    const messages: readonly unknown[] = [
      completedAssistantMessage("message-1"),
      completedAssistantMessage("message-2", 200),
      incompleteAssistantMessage,
      userMessage,
    ]
    const mappedMessages = messages.flatMap((message) => {
      const usage = toCompletedUsageFromMessage(message)
      return usage === null ? [] : [usage]
    })

    expect(mappedMessages).toEqual([
      expect.objectContaining({ receiptKey: "message:message-1", tokenDelta: 150 }),
      expect.objectContaining({ receiptKey: "message:message-2", tokenDelta: 200 }),
    ])
  })

  test("Given completed assistant messages When the server reconciles an idle session Then it records the mapped usage", async () => {
    const appliedReceipts: UsageReceiptMetadata[] = []
    const repository = {
      spawnPartner: () => ({
        partnerId: "partner-1",
        generation: 1,
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-07-31T00:00:00.000Z",
        retiredAt: null,
      }),
      applyUsageReceipt(receipt: UsageReceiptMetadata): ApplyUsageReceiptOutcome {
        appliedReceipts.push(receipt)
        return { kind: "applied" }
      },
      freeze: () => ({ kind: "already_frozen" as const }),
      unfreeze: () => ({ kind: "already_unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "already_set" as const, cheatNodeId }),
      close: async () => {},
    } satisfies PartnerLifecycle & UsageLedger & VpetControl & { close(): Promise<void> }
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => repository,
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      evolutionSelector: () => 0,
      fetchMessages: async () => [completedAssistantMessage("message-3", 300)],
    })

    await fixture.dispatch({ type: "session.idle", data: { sessionID: "session-1" } })
    await cleanup()

    expect(appliedReceipts).toEqual([expect.objectContaining({ receiptKey: "message:message-3", tokenDelta: 300 })])
  })

  test("Given a session context fake When the fetcher runs Then it requests that exact session", async () => {
    const requested: string[] = []
    const fetchMessages = createSessionMessagesFetcher({
      session: {
        async context({ sessionID }) {
          requested.push(sessionID)
          return [completedAssistantMessage("message-context")]
        },
      },
    })

    const messages = [completedAssistantMessage("message-context")]

    expect(await fetchMessages("session-1")).toEqual(messages)
    expect(requested).toEqual(["session-1"])
  })
})
