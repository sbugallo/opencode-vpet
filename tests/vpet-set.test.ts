import { describe, expect, test } from "bun:test"
import type { DigimonCatalog } from "../src/data/catalog.ts"

import { createVpetCommandDefinitions } from "../src/adapters/opencode/server-plugin.ts"
import { runVpetSetCommand } from "../src/commands/vpet-set.ts"

const nodes = [
  {
    id: "0-001",
    nameEn: "Digitama",
    nameJp: "Digitama",
    nextEvolutions: [],
    sprite: "egg",
    stage: 0,
    url: "https://example.test/egg",
  },
  {
    id: "7-001",
    nameEn: "Susanoomon",
    nameJp: "Susanoomon",
    nextEvolutions: [],
    sprite: "susanoomon",
    stage: 7,
    url: "https://example.test/susanoomon",
  },
] as const

const catalog: DigimonCatalog = {
  nodes,
  byId: new Map(nodes.map((node) => [node.id, node])),
}

describe("vpet set command", () => {
  test("Given whitespace-padded egg and terminal IDs When set runs Then it trims and returns exact catalog-backed results", async () => {
    const calls: string[] = []
    const control = {
      setCheatNode: (cheatNodeId: string) => {
        calls.push(cheatNodeId)
        return { kind: "set" as const, cheatNodeId }
      },
    }
    const loadCatalog = async () => catalog

    const egg = await runVpetSetCommand(control, { arguments: "  0-001  " }, loadCatalog)
    const terminal = await runVpetSetCommand(control, { arguments: "\t7-001\t" }, loadCatalog)

    expect(egg).toEqual({
      message: "VPet set to Digitama (0-001).",
      variant: "info",
      event: { kind: "set", nodeId: "0-001" },
    })
    expect(terminal).toEqual({
      message: "VPet set to Susanoomon (7-001).",
      variant: "info",
      event: { kind: "set", nodeId: "7-001" },
    })
    expect(calls).toEqual(["0-001", "7-001"])
  })

  test.each(["", "   ", "0-001 7-001", "0-001\n7-001", "0-001\n", "\n0-001"])(
    "Given malformed arguments %p When set runs Then it returns usage and makes zero writes",
    async (arguments_) => {
      let writes = 0
      const control = {
        setCheatNode: (cheatNodeId: string) => {
          writes += 1
          return { kind: "set" as const, cheatNodeId }
        },
      }

      const result = await runVpetSetCommand(control, { arguments: arguments_ }, async () => catalog)

      expect(result).toEqual({ message: "Usage: /vpet-set <id>.", variant: "warning" })
      expect(writes).toBe(0)
    },
  )

  test("Given an unknown ID When set runs Then it returns the exact error and makes zero writes", async () => {
    let writes = 0
    const result = await runVpetSetCommand(
      {
        setCheatNode: () => {
          writes += 1
          return { kind: "set" as const, cheatNodeId: "missing" }
        },
      },
      { arguments: "missing" },
      async () => catalog,
    )

    expect(result).toEqual({ message: "Unknown Digimon ID: missing.", variant: "warning" })
    expect(writes).toBe(0)
  })

  test("Given same and replacement IDs When set runs Then it writes each valid requested ID and always uses the catalog name", async () => {
    const calls: string[] = []
    const control = {
      setCheatNode: (cheatNodeId: string) => {
        calls.push(cheatNodeId)
        return { kind: calls.length === 1 ? ("already_set" as const) : ("set" as const), cheatNodeId }
      },
    }

    const same = await runVpetSetCommand(control, { arguments: "0-001" }, async () => catalog)
    const replacement = await runVpetSetCommand(control, { arguments: "7-001" }, async () => catalog)

    expect(same).toEqual({ message: "VPet set to Digitama (0-001).", variant: "info" })
    expect(replacement).toEqual({
      message: "VPet set to Susanoomon (7-001).",
      variant: "info",
      event: { kind: "set", nodeId: "7-001" },
    })
    expect(calls).toEqual(["0-001", "7-001"])
  })

  test("Given catalog or control failures When set runs Then the failure propagates without a command result", async () => {
    const catalogFailure = new Error("catalog failed")
    await expect(
      runVpetSetCommand(
        { setCheatNode: () => ({ kind: "set" as const, cheatNodeId: "0-001" }) },
        { arguments: "0-001" },
        async () => {
          throw catalogFailure
        },
      ),
    ).rejects.toBe(catalogFailure)

    const controlFailure = new Error("set failed")
    await expect(
      runVpetSetCommand(
        {
          setCheatNode: () => {
            throw controlFailure
          },
        },
        { arguments: "0-001" },
        async () => catalog,
      ),
    ).rejects.toBe(controlFailure)
  })

  test("Given a complete repository When the command definitions dispatch vpet-set Then it routes valid raw prompt text once", async () => {
    const calls: string[] = []
    const emitted: unknown[] = []
    const definitions = createVpetCommandDefinitions({
      repository: {
        freeze: () => ({ kind: "frozen" as const }),
        unfreeze: () => ({ kind: "unfrozen" as const }),
        setCheatNode: (cheatNodeId: string) => {
          calls.push(cheatNodeId)
          return { kind: "set" as const, cheatNodeId }
        },
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
      loadCatalog: async () => catalog,
    })

    const set = definitions.find((definition) => definition.name === "vpet-set")
    if (set === undefined) throw new Error("Expected vpet-set definition")
    await set.execute({ prompt: { text: " 0-001 " } })

    expect(calls).toEqual(["0-001"])
    expect(emitted).toEqual([
      { message: "VPet set to Digitama (0-001).", variant: "info", event: { kind: "set", nodeId: "0-001" } },
    ])
  })
})
