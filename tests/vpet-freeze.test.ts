import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk"

import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
import { runVpetFreezeCommand } from "../src/commands/vpet-freeze.ts"

describe("vpet freeze command", () => {
  test("Given a VPet control When freeze runs repeatedly Then it returns the exact success text for both transitions", async () => {
    let freezeCalls = 0
    const control = {
      freeze: () => {
        freezeCalls += 1
        return freezeCalls === 1 ? { kind: "frozen" as const } : { kind: "already_frozen" as const }
      },
    }

    const first = await runVpetFreezeCommand(control, { sessionID: "session-1", messageID: "freeze-1" })
    const second = await runVpetFreezeCommand(control, { sessionID: "session-1", messageID: "freeze-2" })

    expect(first).toEqual({
      parts: [{ id: "freeze-1", sessionID: "session-1", messageID: "freeze-1", type: "text", text: "VPet frozen." }],
      event: { kind: "frozen" },
    })
    expect(second).toEqual({
      parts: [{ id: "freeze-2", sessionID: "session-1", messageID: "freeze-2", type: "text", text: "VPet frozen." }],
    })
    expect(freezeCalls).toBe(2)
  })

  test("Given a complete repository When the hook dispatches exact command names Then freeze routes once and unrelated commands do nothing", async () => {
    let freezeCalls = 0
    const repository = {
      freeze: () => {
        freezeCalls += 1
        return { kind: "frozen" as const }
      },
      unfreeze: () => ({ kind: "unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
      spawnPartner: () => ({
        partnerId: "partner-1",
        generation: 1,
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-08-22T00:00:00.000Z",
        retiredAt: null,
      }),
      applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const freezeOutput = { parts: [] as Part[] }
    const otherOutput = { parts: [] as Part[] }

    await hooks["command.execute.before"]?.(
      { command: "vpet-freeze", sessionID: "session-1", arguments: "" },
      freezeOutput,
    )
    await hooks["command.execute.before"]?.(
      { command: "vpet-freeze ", sessionID: "session-1", arguments: "" },
      otherOutput,
    )

    expect(freezeOutput.parts).toEqual([expect.objectContaining({ type: "text", text: "VPet frozen." })])
    expect(otherOutput.parts).toEqual([])
    expect(freezeCalls).toBe(1)
  })

  test("Given repeated freeze invocations When the hook appends output Then each part ID is unique", async () => {
    const repository = {
      freeze: () => ({ kind: "frozen" as const }),
      unfreeze: () => ({ kind: "unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
      spawnPartner: () => ({
        partnerId: "partner-1",
        generation: 1,
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-08-22T00:00:00.000Z",
        retiredAt: null,
      }),
      applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const first = { parts: [] as Part[] }
    const second = { parts: [] as Part[] }

    await hooks["command.execute.before"]?.({ command: "vpet-freeze", sessionID: "session-1", arguments: "" }, first)
    await hooks["command.execute.before"]?.({ command: "vpet-freeze", sessionID: "session-1", arguments: "" }, second)

    expect(first.parts[0]?.id).not.toBe(second.parts[0]?.id)
  })

  test("Given a control failure When freeze runs Then the failure propagates without a part", async () => {
    const failure = new Error("freeze failed")
    const output = { parts: [] as Part[] }
    const repository = {
      freeze: () => {
        throw failure
      },
      unfreeze: () => ({ kind: "unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
      spawnPartner: () => ({
        partnerId: "partner-1",
        generation: 1,
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-08-22T00:00:00.000Z",
        retiredAt: null,
      }),
      applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const handler = hooks["command.execute.before"]
    if (handler === undefined) throw new Error("Expected command handler")

    await expect(handler({ command: "vpet-freeze", sessionID: "session-1", arguments: "" }, output)).rejects.toBe(
      failure,
    )
    expect(output.parts).toEqual([])
  })
})
