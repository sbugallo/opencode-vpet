import { afterEach, describe, expect, mock, test } from "bun:test"
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { UsageProcessingResult } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { UsageLedger } from "@jcendal/digital-pet-core/application/ports/usage-ledger.ts"
import type { Partner } from "@jcendal/digital-pet-core/domain/partner.ts"

import type { HookEventRecord } from "../src/adapters/cursor/types.ts"

mock.module("../src/adapters/cursor/cursor-api-watermark.ts", () => ({
  captureWatermark: async () => ({ timestampMs: 0, fingerprint: "test-watermark" }),
  settleTurnDelta: async () => ({
    receiptKey: "cursor-api:gen-api",
    eventId: "cursor-api:gen-api",
    tokenDelta: 12,
    cost: null,
    createdAt: "2026-09-09T00:00:01.000Z",
  }),
}))

import { createCursorUsageEventSource } from "../src/adapters/cursor/cursor-usage-event-source.ts"

const wait = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const activePartner: Partner = {
  partnerId: "partner-1",
  generation: 1,
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
  retiredAt: null,
}

const createLedger = (): UsageLedger & { readonly receiptKeys: string[] } => {
  const receiptKeys: string[] = []
  return {
    receiptKeys,
    applyUsageReceipt: (metadata, evolve) => {
      receiptKeys.push(metadata.receiptKey)
      evolve(activePartner)
      return { kind: "applied" }
    },
  }
}

const appendHookEvent = async (eventsPath: string, record: HookEventRecord): Promise<void> => {
  await appendFile(eventsPath, `${JSON.stringify(record)}\n`, "utf8")
}

const createHookEventsFixture = async (): Promise<{ tempRoot: string; eventsPath: string }> => {
  const tempRoot = await mkdtemp(join(process.cwd(), ".tmp-cursor-digital-pet-hook-events-"))
  const eventsPath = join(tempRoot, "events.jsonl")
  await writeFile(eventsPath, "", "utf8")
  return { tempRoot, eventsPath }
}

describe("cursor usage event source", () => {
  let tempRoot: string | undefined
  let source: ReturnType<typeof createCursorUsageEventSource> | undefined

  afterEach(async () => {
    source?.dispose()
    source = undefined
    if (tempRoot !== undefined) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = undefined
    }
  })

  test("Given a stop hook with token fields When the events file changes Then usage is applied once", async () => {
    const fixture = await createHookEventsFixture()
    tempRoot = fixture.tempRoot
    const { eventsPath } = fixture

    const ledger = createLedger()
    const applied: UsageProcessingResult[] = []
    source = createCursorUsageEventSource(
      ledger,
      (result) => {
        applied.push(result)
      },
      { eventsPath, settleDelayMs: 50 },
    )

    await wait(50)
    await appendHookEvent(eventsPath, {
      receivedAt: "2026-09-09T00:00:00.000Z",
      hookEventName: "stop",
      payload: {
        hook_event_name: "stop",
        generation_id: "gen-stop",
        input_tokens: 100,
        output_tokens: 50,
      },
    })

    await wait(150)
    expect(ledger.receiptKeys).toEqual(["cursor-turn:gen-stop"])
    expect(applied.some((result) => result.kind === "applied")).toBe(true)
  })

  test("Given duplicate stop receipts When events are replayed Then usage is applied only once", async () => {
    const fixture = await createHookEventsFixture()
    tempRoot = fixture.tempRoot
    const { eventsPath } = fixture

    const ledger = createLedger()
    source = createCursorUsageEventSource(ledger, undefined, { eventsPath, settleDelayMs: 50 })

    const stopEvent: HookEventRecord = {
      receivedAt: "2026-09-09T00:00:00.000Z",
      hookEventName: "stop",
      payload: {
        hook_event_name: "stop",
        generation_id: "gen-dup",
        input_tokens: 10,
        output_tokens: 5,
      },
    }

    await wait(50)
    await appendHookEvent(eventsPath, stopEvent)
    await wait(150)
    await appendHookEvent(eventsPath, stopEvent)
    await wait(150)

    expect(ledger.receiptKeys).toEqual(["cursor-turn:gen-dup"])
  })

  test("Given beforeSubmit and a tokenless stop When the events file changes Then usage falls back to the watermark settle path", async () => {
    const fixture = await createHookEventsFixture()
    tempRoot = fixture.tempRoot
    const { eventsPath } = fixture

    const ledger = createLedger()
    source = createCursorUsageEventSource(ledger, undefined, { eventsPath, settleDelayMs: 50 })

    await wait(50)
    await appendHookEvent(eventsPath, {
      receivedAt: "2026-09-09T00:00:00.000Z",
      hookEventName: "beforeSubmitPrompt",
      payload: {
        hook_event_name: "beforeSubmitPrompt",
        conversation_id: "conv-1",
      },
    })
    await wait(150)
    await appendHookEvent(eventsPath, {
      receivedAt: "2026-09-09T00:00:01.000Z",
      hookEventName: "stop",
      payload: {
        hook_event_name: "stop",
        conversation_id: "conv-1",
        generation_id: "gen-api",
      },
    })

    await wait(250)
    expect(ledger.receiptKeys).toEqual(["cursor-api:gen-api"])
  })

  test("Given a disposed source When new hook events arrive Then usage is not applied", async () => {
    const fixture = await createHookEventsFixture()
    tempRoot = fixture.tempRoot
    const { eventsPath } = fixture

    const ledger = createLedger()
    source = createCursorUsageEventSource(ledger, undefined, { eventsPath, settleDelayMs: 50 })
    await wait(50)
    source.dispose()

    await appendHookEvent(eventsPath, {
      receivedAt: "2026-09-09T00:00:00.000Z",
      hookEventName: "stop",
      payload: {
        hook_event_name: "stop",
        generation_id: "gen-disposed",
        input_tokens: 1,
        output_tokens: 1,
      },
    })

    await wait(150)
    expect(ledger.receiptKeys).toEqual([])
  })
})
