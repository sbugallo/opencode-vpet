import { describe, expect, test } from "bun:test"

import { createVpetCommandDefinitions } from "../src/adapters/opencode/server-plugin.ts"
import { runVpetFreezeCommand } from "../src/commands/vpet-freeze.ts"

describe("vpet freeze command", () => {
  test("Given a VPet control When freeze runs repeatedly Then it returns the exact result for both transitions", async () => {
    let freezeCalls = 0
    const control = {
      freeze: () => {
        freezeCalls += 1
        return freezeCalls === 1 ? { kind: "frozen" as const } : { kind: "already_frozen" as const }
      },
    }

    const first = await runVpetFreezeCommand(control)
    const second = await runVpetFreezeCommand(control)

    expect(first).toEqual({ message: "VPet frozen.", variant: "info", event: { kind: "frozen" } })
    expect(second).toEqual({ message: "VPet is already frozen.", variant: "info" })
    expect(freezeCalls).toBe(2)
  })

  test("Given a complete repository When the command definitions dispatch exact names Then freeze routes once", async () => {
    let freezeCalls = 0
    const emitted: unknown[] = []
    const definitions = createVpetCommandDefinitions({
      repository: {
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
        close: async () => {},
      },
      emit: async (result) => {
        emitted.push(result)
      },
      loadCatalog: async () => {
        throw new Error("catalog should not load")
      },
    })

    const freeze = definitions.find((definition) => definition.name === "vpet-freeze")
    if (freeze === undefined) throw new Error("Expected vpet-freeze definition")
    await freeze.execute({ prompt: { text: "" } })

    expect(freezeCalls).toBe(1)
    expect(emitted).toEqual([{ message: "VPet frozen.", variant: "info", event: { kind: "frozen" } }])
  })

  test("Given a control failure When freeze runs Then the failure propagates without a command result", async () => {
    const failure = new Error("freeze failed")

    await expect(
      runVpetFreezeCommand({
        freeze: () => {
          throw failure
        },
      }),
    ).rejects.toBe(failure)
  })
})
