import { describe, expect, test } from "bun:test"

import { spawnPartner } from "../src/application/use-cases/spawn-partner.ts"
import { createVpetCommandDefinitions } from "../src/adapters/opencode/server-plugin.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { DIGITAMA_FIELD_EGGS } from "../src/data/digimon-data.ts"
import { runVpetSpawnCommand } from "../src/commands/vpet-spawn.ts"

const loadCatalog = async () => DIGIMON_CATALOG

const eggFor = (nodeId: string) => ({
  partnerId: "partner-2",
  generation: 2,
  currentNodeId: nodeId,
  gauge: 0,
  isTerminal: false,
  createdAt: "2026-07-31T00:00:00.000Z",
  retiredAt: null,
})

describe("vpet spawn command", () => {
  test("Given a partner lifecycle When the application spawns a partner Then it uses the requested egg and returns the generation", () => {
    const calls: unknown[] = []
    const lifecycle = {
      spawnPartner(input: unknown) {
        calls.push(input)
        return eggFor("D-002")
      },
    }

    const result = spawnPartner(lifecycle, "D-002", "2026-07-31T00:00:00.000Z")

    expect(calls).toEqual([
      {
        currentNodeId: "D-002",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-07-31T00:00:00.000Z",
      },
    ])
    expect(result).toEqual({ generation: 2, currentNodeId: "D-002" })
  })

  test("Given the vpet spawn command without arguments When it runs Then it spawns a random egg generation", async () => {
    const calls: unknown[] = []
    const repository = {
      spawnPartner(input: unknown) {
        calls.push(input)
        return eggFor("D-002")
      },
    }

    const result = await runVpetSpawnCommand(
      repository,
      { arguments: "", createdAt: "2026-07-31T00:00:00.000Z" },
      loadCatalog,
      () => 0.19,
    )

    expect(calls).toEqual([
      { currentNodeId: "D-002", gauge: 0, isTerminal: false, createdAt: "2026-07-31T00:00:00.000Z" },
    ])
    expect(result).toEqual({
      message: "Spawned Generation 2 from Digiegg (Dragon's Roar).",
      variant: "info",
      event: { kind: "spawned", nodeId: "D-002", generation: 2 },
    })
  })

  test("Given a digitama field argument When it runs Then it spawns that field's egg", async () => {
    const calls: unknown[] = []
    const repository = {
      spawnPartner(input: unknown) {
        calls.push(input)
        return eggFor("D-007")
      },
    }

    const result = await runVpetSpawnCommand(
      repository,
      { arguments: "virus-busters", createdAt: "2026-07-31T00:00:00.000Z" },
      loadCatalog,
    )

    expect(calls).toEqual([
      { currentNodeId: "D-007", gauge: 0, isTerminal: false, createdAt: "2026-07-31T00:00:00.000Z" },
    ])
    expect(result).toEqual({
      message: "Spawned Generation 2 from Digiegg (Virus Busters).",
      variant: "info",
      event: { kind: "spawned", nodeId: "D-007", generation: 2 },
    })
  })

  test("Given an unknown field or extra tokens When it runs Then it warns with usage", async () => {
    const repository = { spawnPartner: () => eggFor("D-001") }
    const createdAt = "2026-07-31T00:00:00.000Z"

    const unknown = await runVpetSpawnCommand(repository, { arguments: "digital-world", createdAt }, loadCatalog)
    const extra = await runVpetSpawnCommand(repository, { arguments: "deep-savers now", createdAt }, loadCatalog)

    expect(unknown.variant).toBe("warning")
    expect(unknown.message).toBe("Unknown digitama field: digital-world.")
    expect(extra.variant).toBe("warning")
    expect(extra.message).toBe(
      "Usage: /vpet-spawn [deep-savers|dragons-roar|jungle-troopers|metal-empire|nature-spirits|nightmare-soldiers|virus-busters|wind-guardians].",
    )
  })

  test("Given every digitama field When eggs are resolved Then each slug maps to a stage-0 catalog node", async () => {
    const catalog = await loadCatalog()

    for (const [, eggId] of Object.entries(DIGITAMA_FIELD_EGGS)) {
      const node = catalog.byId.get(eggId)
      expect(node?.stage).toBe(0)
      expect(node?.nameEn.startsWith("Digiegg")).toBeTrue()
    }
  })

  test("Given a repository stub When the command definitions dispatch vpet-spawn Then it routes once with a random egg", async () => {
    let spawnCalls = 0
    const emitted: unknown[] = []
    const definitions = createVpetCommandDefinitions({
      repository: {
        spawnPartner: (input) => {
          spawnCalls += 1
          return eggFor(input.currentNodeId)
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
      loadCatalog,
    })

    const spawn = definitions.find((definition) => definition.name === "vpet-spawn")
    if (spawn === undefined) throw new Error("Expected vpet-spawn definition")
    await spawn.execute({ prompt: { text: "" } })

    expect(spawnCalls).toBe(1)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({
      message: expect.stringMatching(/^Spawned Generation 2 from Digiegg/),
      variant: "info",
      event: { kind: "spawned", generation: 2 },
    })
  })

  test("Given the field spawn definitions When they are registered Then one command per digitama field exists", async () => {
    const emitted: unknown[] = []
    const definitions = createVpetCommandDefinitions({
      repository: {
        spawnPartner: (input) => eggFor(input.currentNodeId),
        applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
        freeze: () => ({ kind: "frozen" as const }),
        unfreeze: () => ({ kind: "unfrozen" as const }),
        setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
        close: async () => {},
      },
      emit: async (result) => {
        emitted.push(result)
      },
      loadCatalog,
    })

    const fieldDefinitions = definitions.filter((definition) => definition.name.startsWith("vpet-spawn-"))
    expect(fieldDefinitions.map((definition) => definition.name)).toEqual([
      "vpet-spawn-deep-savers",
      "vpet-spawn-dragons-roar",
      "vpet-spawn-jungle-troopers",
      "vpet-spawn-metal-empire",
      "vpet-spawn-nature-spirits",
      "vpet-spawn-nightmare-soldiers",
      "vpet-spawn-virus-busters",
      "vpet-spawn-wind-guardians",
    ])

    const definition = fieldDefinitions[0]
    if (definition === undefined) throw new Error("Expected deep-savers definition")
    await definition.execute({ prompt: { text: "" } })

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ event: { kind: "spawned", nodeId: "D-001", generation: 2 } })
  })

  test("Given a lifecycle that throws When vpet-spawn runs Then the error propagates without a command result", async () => {
    const failure = new Error("spawn failed")
    const repository = {
      spawnPartner: () => {
        throw failure
      },
    }

    await expect(
      runVpetSpawnCommand(repository, { arguments: "", createdAt: "2026-07-31T00:00:00.000Z" }, loadCatalog, () => 0),
    ).rejects.toBe(failure)
  })
})
