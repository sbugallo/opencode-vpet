import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk"

import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
import { runDigitalPetUnfreezeCommand } from "../src/commands/digital-pet-unfreeze.ts"

describe("digital-pet unfreeze command", () => {
  test("Given a Digital Pet control When unfreeze runs repeatedly Then it returns the exact success text for both transitions", async () => {
    let unfreezeCalls = 0
    const control = {
      unfreeze: () => {
        unfreezeCalls += 1
        return unfreezeCalls === 1 ? { kind: "unfrozen" as const } : { kind: "already_unfrozen" as const }
      },
    }

    const first = await runDigitalPetUnfreezeCommand(control, { sessionID: "session-1", messageID: "unfreeze-1" })
    const second = await runDigitalPetUnfreezeCommand(control, { sessionID: "session-1", messageID: "unfreeze-2" })

    expect(first).toEqual({
      parts: [
        {
          id: "unfreeze-1",
          sessionID: "session-1",
          messageID: "unfreeze-1",
          type: "text",
          text: "Digital Pet unfrozen.",
        },
      ],
      event: { kind: "unfrozen" },
    })
    expect(second).toEqual({
      parts: [
        {
          id: "unfreeze-2",
          sessionID: "session-1",
          messageID: "unfreeze-2",
          type: "text",
          text: "Digital Pet unfrozen.",
        },
      ],
    })
    expect(unfreezeCalls).toBe(2)
  })

  test("Given a complete repository When the hook dispatches digital-pet-unfreeze Then it routes once", async () => {
    let unfreezeCalls = 0
    const repository = {
      freeze: () => ({ kind: "frozen" as const }),
      unfreeze: () => {
        unfreezeCalls += 1
        return { kind: "unfrozen" as const }
      },
      setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
      spawnPartner: () => ({
        partnerId: "partner-1",
        generation: 1,
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-08-22T00:00:00.000Z",
        retiredAt: null,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      }),
      applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const output = { parts: [] as Part[] }

    await hooks["command.execute.before"]?.(
      { command: "digital-pet-unfreeze", sessionID: "session-1", arguments: "" },
      output,
    )

    expect(output.parts).toEqual([expect.objectContaining({ type: "text", text: "Digital Pet unfrozen." })])
    expect(unfreezeCalls).toBe(1)
  })

  test("Given a control failure When unfreeze runs Then the failure propagates without a command result", async () => {
    const failure = new Error("unfreeze failed")

    await expect(
      runDigitalPetUnfreezeCommand(
        {
          unfreeze: () => {
            throw failure
          },
        },
        { sessionID: "session-1", messageID: "unfreeze-failure" },
      ),
    ).rejects.toBe(failure)
  })
})
