import { describe, expect, test } from "bun:test"

import { createVpetCommandDefinitions } from "../src/adapters/opencode/server-plugin.ts"
import { runVpetUnfreezeCommand } from "../src/commands/vpet-unfreeze.ts"

describe("vpet unfreeze command", () => {
  test("Given a VPet control When unfreeze runs repeatedly Then it returns the exact result for both transitions", async () => {
    let unfreezeCalls = 0
    const control = {
      unfreeze: () => {
        unfreezeCalls += 1
        return unfreezeCalls === 1 ? { kind: "unfrozen" as const } : { kind: "already_unfrozen" as const }
      },
    }

    const first = await runVpetUnfreezeCommand(control)
    const second = await runVpetUnfreezeCommand(control)

    expect(first).toEqual({ message: "VPet unfrozen.", variant: "info", event: { kind: "unfrozen" } })
    expect(second).toEqual({ message: "VPet is not frozen.", variant: "info" })
    expect(unfreezeCalls).toBe(2)
  })

  test("Given a complete repository When the command definitions dispatch vpet-unfreeze Then it routes once", async () => {
    let unfreezeCalls = 0
    const emitted: unknown[] = []
    const definitions = createVpetCommandDefinitions({
      repository: {
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

    const unfreeze = definitions.find((definition) => definition.name === "vpet-unfreeze")
    if (unfreeze === undefined) throw new Error("Expected vpet-unfreeze definition")
    await unfreeze.execute({ prompt: { text: "" } })

    expect(unfreezeCalls).toBe(1)
    expect(emitted).toEqual([{ message: "VPet unfrozen.", variant: "info", event: { kind: "unfrozen" } }])
  })

  test("Given a control failure When unfreeze runs Then the failure propagates without a command result", async () => {
    const failure = new Error("unfreeze failed")

    await expect(
      runVpetUnfreezeCommand({
        unfreeze: () => {
          throw failure
        },
      }),
    ).rejects.toBe(failure)
  })
})
