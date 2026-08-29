import { describe, expect, test } from "bun:test"
import type { AssistantMessage, Event, Message, UserMessage } from "@opencode-ai/sdk"

import { toCompletedUsageFromEvent, toCompletedUsageFromMessage } from "../src/adapters/opencode/usage-event-mapper.ts"
import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
import { createSessionMessagesFetcher } from "../src/adapters/opencode/session-messages.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { PartnerLifecycle } from "../src/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import type { VpetControl } from "../src/application/ports/vpet-control.ts"

const completedAssistantEvent = {
  type: "message.updated",
  properties: {
    info: {
      id: "message-1",
      sessionID: "session-1",
      role: "assistant",
      time: { created: 1, completed: 2 },
      parentID: "parent-1",
      modelID: "model-1",
      providerID: "provider-1",
      mode: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 10, output: 20, reasoning: 30, cache: { read: 40, write: 50 } },
    },
  },
} satisfies Event

const completedAssistantMessage = (id: string, tokenDelta: number): AssistantMessage => ({
  ...completedAssistantEvent.properties.info,
  id,
  tokens: { input: tokenDelta, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

const incompleteAssistantMessage = {
  ...completedAssistantEvent.properties.info,
  id: "incomplete-message",
  time: { created: 1 },
} satisfies AssistantMessage

const userMessage = {
  id: "user-message",
  sessionID: "session-1",
  role: "user",
  time: { created: 1 },
  agent: "build",
  model: { providerID: "provider-1", modelID: "model-1" },
} satisfies UserMessage

describe("usage event ingestion", () => {
  test("Given a completed assistant update When extracting its receipt Then every token category is aggregated under the message id", () => {
    expect(toCompletedUsageFromEvent(completedAssistantEvent)).toEqual({
      receiptKey: "message:message-1",
      eventId: "usage:message-1",
      tokenDelta: 150,
      cost: null,
      createdAt: "1970-01-01T00:00:00.002Z",
    })
  })

  test("Given a non-completed or non-assistant update When extracting its receipt Then it is ignored", () => {
    const incomplete = {
      ...completedAssistantEvent,
      properties: {
        info: {
          ...completedAssistantEvent.properties.info,
          time: { created: 1 },
        },
      },
    } satisfies Event

    expect(toCompletedUsageFromEvent(incomplete)).toBeNull()
    expect(toCompletedUsageFromMessage(incompleteAssistantMessage)).toBeNull()
    expect(toCompletedUsageFromMessage(userMessage)).toBeNull()
  })

  test("Given a completed assistant update with non-positive or non-finite costs When extracting its receipt Then cost is normalized to null without changing stable ids", () => {
    const invalidCosts = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

    for (const cost of invalidCosts) {
      const message = {
        ...completedAssistantEvent.properties.info,
        id: `message-cost-${String(cost)}`,
        cost,
      } satisfies AssistantMessage
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

  test("Given a completed assistant update with a positive finite cost When extracting its receipt Then the cost and message-derived ids are preserved", () => {
    const message = {
      ...completedAssistantEvent.properties.info,
      id: "message-priced",
      cost: 1.25,
    } satisfies AssistantMessage

    expect(toCompletedUsageFromMessage(message)).toEqual(
      expect.objectContaining({
        receiptKey: "message:message-priced",
        eventId: "usage:message-priced",
        cost: 1.25,
      }),
    )
  })

  test("Given direct and idle SDK messages When translating them Then both paths yield the same completed application usages and filter incomplete and user messages", () => {
    const messages: readonly Message[] = [
      completedAssistantEvent.properties.info,
      completedAssistantMessage("message-2", 200),
      incompleteAssistantMessage,
      userMessage,
    ]
    const directUsage = toCompletedUsageFromEvent(completedAssistantEvent)
    const mappedMessages = messages.flatMap((message) => {
      const usage = toCompletedUsageFromMessage(message)
      return usage === null ? [] : [usage]
    })

    expect(mappedMessages).toEqual([
      directUsage,
      expect.objectContaining({ receiptKey: "message:message-2", tokenDelta: 200 }),
    ])
  })

  test("Given a completed assistant update When the server hook receives it Then it records the mapped usage", async () => {
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
    } satisfies PartnerLifecycle & UsageLedger & VpetControl
    const hooks = createServerHooks({ repository, resource: { close: async () => {} }, evolutionSelector: () => 0 })
    const handleEvent = hooks.event

    if (handleEvent === undefined) throw new Error("Expected usage event hook")

    await handleEvent({ event: completedAssistantEvent })

    expect(appliedReceipts).toEqual([expect.objectContaining({ receiptKey: "message:message-1", tokenDelta: 150 })])
  })

  test("Given an idle hook and SDK client fake When the session becomes idle Then the client fetches that session and reconciles its completed assistant messages", async () => {
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
    } satisfies PartnerLifecycle & UsageLedger & VpetControl
    const fetchMessages = createSessionMessagesFetcher({
      session: {
        async messages({ path }) {
          expect(path.id).toBe("session-1")
          return { data: [{ info: completedAssistantMessage("message-3", 300), parts: [] }] }
        },
      },
    })
    const hooks = createServerHooks({
      repository,
      resource: { close: async () => {} },
      evolutionSelector: () => 0,
      fetchMessages,
    })
    const event = { type: "session.idle", properties: { sessionID: "session-1" } } satisfies Event
    const handleEvent = hooks.event
    if (handleEvent === undefined) throw new Error("Expected usage event hook")

    await handleEvent({ event })

    expect(appliedReceipts).toEqual([expect.objectContaining({ receiptKey: "message:message-3", tokenDelta: 300 })])
  })

  test("Given an idle SDK response without data When fetching session messages Then it rejects with the exact idle-session error", () => {
    const fetchMessages = createSessionMessagesFetcher({
      session: {
        async messages({ path }) {
          expect(path.id).toBe("idle-session-1")
          return { data: undefined }
        },
      },
    })

    return expect(fetchMessages("idle-session-1")).rejects.toThrow(
      "Unable to list messages for idle session idle-session-1",
    )
  })
})
