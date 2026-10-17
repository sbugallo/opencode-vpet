import { describe, expect, test } from "bun:test"

import { spawnPartner } from "../src/application/use-cases/spawn-partner.ts"
import { createVpetCommandDefinitions } from "../src/adapters/opencode/server-plugin.ts"
import { runVpetSpawnCommand } from "../src/commands/vpet-spawn.ts"

describe("vpet spawn command", () => {
  test("Given a partner lifecycle When the application spawns a partner Then it uses the fixed initial state and returns the generation", () => {
    const calls: unknown[] = []
    const lifecycle = {
      spawnPartner(input: unknown) {
        calls.push(input)
        return {
          partnerId: "partner-2",
          generation: 2,
          currentNodeId: "0-001",
          gauge: 0,
          isTerminal: false,
          createdAt: "2026-07-31T00:00:00.000Z",
          retiredAt: null,
        }
      },
    }

    const result = spawnPartner(lifecycle, "2026-07-31T00:00:00.000Z")

    expect(calls).toEqual([
      {
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-07-31T00:00:00.000Z",
      },
    ])
    expect(result).toEqual({ generation: 2 })
  })

  test("Given the vpet spawn command When it runs Then it atomically creates the egg generation and returns the result", async () => {
    const spawned = {
      partnerId: "partner-2",
      generation: 2,
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      createdAt: "2026-07-31T00:00:00.000Z",
      retiredAt: null,
    }
    const calls: unknown[] = []
    const repository = {
      spawnPartner(input: unknown) {
        calls.push(input)
        return spawned
      },
    }

    const result = await runVpetSpawnCommand(repository, { createdAt: spawned.createdAt })

    expect(calls).toEqual([{ currentNodeId: "0-001", gauge: 0, isTerminal: false, createdAt: spawned.createdAt }])
    expect(result).toEqual({
      message: "Spawned Generation 2.",
      variant: "info",
      event: { kind: "spawned", nodeId: "0-001", generation: 2 },
    })
  })

  test("Given a repository stub When the command definitions dispatch vpet-spawn Then it routes once", async () => {
    let spawnCalls = 0
    const emitted: unknown[] = []
    const definitions = createVpetCommandDefinitions({
      repository: {
        spawnPartner: () => {
          spawnCalls += 1
          return {
            partnerId: "partner-2",
            generation: 2,
            currentNodeId: "0-001",
            gauge: 0,
            isTerminal: false,
            createdAt: "2026-07-31T00:00:00.000Z",
            retiredAt: null,
          }
        },
        applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
        freeze: () => ({ kind: "frozen" as const }),
        unfreeze: () => ({ kind: "unfrozen" as const }),
        setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
        close: async () => {},
      },
      emit: async (result) => {
        emitted.push(result)
      },
      loadCatalog: async () => {
        throw new Error("catalog should not load")
      },
    })

    const spawn = definitions.find((definition) => definition.name === "vpet-spawn")
    if (spawn === undefined) throw new Error("Expected vpet-spawn definition")
    await spawn.execute({ prompt: { text: "" } })

    expect(spawnCalls).toBe(1)
    expect(emitted).toEqual([
      { message: "Spawned Generation 2.", variant: "info", event: { kind: "spawned", nodeId: "0-001", generation: 2 } },
    ])
  })

  test("Given a lifecycle that throws When vpet-spawn runs Then the error propagates without a command result", async () => {
    const failure = new Error("spawn failed")
    const repository = {
      spawnPartner: () => {
        throw failure
      },
    }

    await expect(runVpetSpawnCommand(repository, { createdAt: "2026-07-31T00:00:00.000Z" })).rejects.toBe(failure)
  })
})
