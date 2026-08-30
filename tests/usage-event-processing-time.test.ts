import { describe, expect, test } from "bun:test"
import type { Event, Message } from "@opencode-ai/sdk"

import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
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
const completedAssistantMessage = (id: string, tokenDelta: number) => ({
  ...completedAssistantEvent.properties.info,
  id,
  tokens: { input: tokenDelta, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

describe("usage event processing time", () => {
  test("Given control state changes before direct and idle processing When each path applies its receipt Then both observe the mode at processing time", async () => {
    let processingMode: "normal" | "frozen" | "cheat" = "normal"
    const appliedModes: { readonly receiptKey: string; readonly mode: "normal" | "frozen" | "cheat" }[] = []
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
        appliedModes.push({ receiptKey: receipt.receiptKey, mode: processingMode })
        return { kind: "applied" }
      },
      freeze: () => ({ kind: "already_frozen" as const }),
      unfreeze: () => ({ kind: "already_unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "already_set" as const, cheatNodeId }),
    } satisfies PartnerLifecycle & UsageLedger & VpetControl
    const fetchMessages = async (): Promise<readonly Message[]> => [
      completedAssistantMessage("message-idle-processing-time", 300),
    ]
    const handleEvent = createServerHooks({
      repository,
      resource: { close: async () => {} },
      evolutionSelector: () => 0,
      fetchMessages,
    }).event
    if (handleEvent === undefined) throw new Error("Expected usage event hook")
    processingMode = "frozen"
    await handleEvent({ event: completedAssistantEvent })
    processingMode = "cheat"
    await handleEvent({ event: { type: "session.idle", properties: { sessionID: "session-1" } } satisfies Event })
    expect(appliedModes).toEqual([
      { receiptKey: "message:message-1", mode: "frozen" },
      { receiptKey: "message:message-idle-processing-time", mode: "cheat" },
    ])
  })
})
