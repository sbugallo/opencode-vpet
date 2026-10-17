import { describe, expect, test } from "bun:test"

import { setupVpetServer } from "../src/adapters/opencode/server-plugin.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { PartnerLifecycle } from "../src/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import type { VpetControl } from "../src/application/ports/vpet-control.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { createServerContextFixture } from "./server-context-fixture.ts"

const completedAssistantMessage = (id: string, tokenDelta: number) => ({
  id,
  type: "assistant",
  time: { created: 1, completed: 2 },
  tokens: { input: tokenDelta, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

describe("usage event processing time", () => {
  test("Given control state changes before reconciliation When it applies its receipt Then it observes the mode at processing time", async () => {
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
      close: async () => {},
    } satisfies PartnerLifecycle & UsageLedger & VpetControl & { close(): Promise<void> }
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => repository,
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      evolutionSelector: () => 0,
      fetchMessages: async () => [completedAssistantMessage("message-idle-processing-time", 300)],
    })

    processingMode = "frozen"
    await fixture.dispatch({ type: "session.idle", data: { sessionID: "session-1" } })
    processingMode = "cheat"
    await fixture.dispatch({ type: "session.execution.succeeded", data: { sessionID: "session-1" } })
    await cleanup()

    expect(appliedModes).toEqual([
      { receiptKey: "message:message-idle-processing-time", mode: "frozen" },
      { receiptKey: "message:message-idle-processing-time", mode: "cheat" },
    ])
  })
})
