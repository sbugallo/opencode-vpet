import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk"
import type { DigimonCatalog } from "../src/data/catalog.ts"

import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
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
  test("Given whitespace-padded egg and terminal IDs When set runs Then it trims and returns exact catalog-backed messages", async () => {
    const calls: string[] = []
    const control = {
      setCheatNode: (cheatNodeId: string) => {
        calls.push(cheatNodeId)
        return { kind: "set" as const, cheatNodeId }
      },
    }
    const loadCatalog = async () => catalog

    const egg = await runVpetSetCommand(
      control,
      { sessionID: "session-1", messageID: "set-egg", arguments: "  0-001  " },
      loadCatalog,
    )
    const terminal = await runVpetSetCommand(
      control,
      { sessionID: "session-1", messageID: "set-terminal", arguments: "\t7-001\t" },
      loadCatalog,
    )

    expect(egg).toEqual({
      parts: [
        {
          id: "set-egg",
          sessionID: "session-1",
          messageID: "set-egg",
          type: "text",
          text: "VPet set to Digitama (0-001).",
        },
      ],
      event: { kind: "set", nodeId: "0-001" },
    })
    expect(terminal).toEqual({
      parts: [
        {
          id: "set-terminal",
          sessionID: "session-1",
          messageID: "set-terminal",
          type: "text",
          text: "VPet set to Susanoomon (7-001).",
        },
      ],
      event: { kind: "set", nodeId: "7-001" },
    })
    expect(calls).toEqual(["0-001", "7-001"])
  })

  test.each(["", "   ", "0-001 7-001", "0-001\n7-001", "0-001\n", "\n0-001"])(
    "Given malformed arguments %p When set runs Then it appends usage and makes zero writes",
    async (arguments_) => {
      let writes = 0
      const control = {
        setCheatNode: (cheatNodeId: string) => {
          writes += 1
          return { kind: "set" as const, cheatNodeId }
        },
      }

      const result = await runVpetSetCommand(
        control,
        { sessionID: "session-1", messageID: "invalid", arguments: arguments_ },
        async () => catalog,
      )

      expect(result).toEqual({
        parts: [
          { id: "invalid", sessionID: "session-1", messageID: "invalid", type: "text", text: "Usage: /vpet-set <id>." },
        ],
      })
      expect(writes).toBe(0)
    },
  )

  test("Given an unknown ID When set runs Then it appends the exact error and makes zero writes", async () => {
    let writes = 0
    const result = await runVpetSetCommand(
      {
        setCheatNode: () => {
          writes += 1
          return { kind: "set" as const, cheatNodeId: "missing" }
        },
      },
      { sessionID: "session-1", messageID: "unknown", arguments: "missing" },
      async () => catalog,
    )

    expect(result).toEqual({
      parts: [
        {
          id: "unknown",
          sessionID: "session-1",
          messageID: "unknown",
          type: "text",
          text: "Unknown Digimon ID: missing.",
        },
      ],
    })
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

    const same = await runVpetSetCommand(
      control,
      { sessionID: "session-1", messageID: "same", arguments: "0-001" },
      async () => catalog,
    )
    const replacement = await runVpetSetCommand(
      control,
      { sessionID: "session-1", messageID: "replacement", arguments: "7-001" },
      async () => catalog,
    )

    expect(same).toEqual({ parts: [expect.objectContaining({ text: "VPet set to Digitama (0-001)." })] })
    expect(replacement).toEqual({
      parts: [expect.objectContaining({ text: "VPet set to Susanoomon (7-001)." })],
      event: { kind: "set", nodeId: "7-001" },
    })
    expect(calls).toEqual(["0-001", "7-001"])
  })

  test("Given catalog or control failures When set runs Then the failure propagates without a part", async () => {
    const catalogFailure = new Error("catalog failed")
    await expect(
      runVpetSetCommand(
        { setCheatNode: () => ({ kind: "set" as const, cheatNodeId: "0-001" }) },
        { sessionID: "session-1", messageID: "catalog-failure", arguments: "0-001" },
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
        { sessionID: "session-1", messageID: "control-failure", arguments: "0-001" },
        async () => catalog,
      ),
    ).rejects.toBe(controlFailure)
  })

  test("Given a complete repository When the hook dispatches vpet-set Then it routes valid raw input once", async () => {
    const calls: string[] = []
    const repository = {
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
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const output = { parts: [] as Part[] }

    await hooks["command.execute.before"]?.(
      { command: "vpet-set", sessionID: "session-1", arguments: " 0-001 " },
      output,
    )

    expect(output.parts).toEqual([expect.objectContaining({ text: "VPet set to Digiegg (0-001)." })])
    expect(calls).toEqual(["0-001"])
  })
})
