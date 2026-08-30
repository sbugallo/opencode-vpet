import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk"

import { spawnPartner } from "../src/application/use-cases/spawn-partner.ts"
import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
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

  test("Given the vpet spawn command When it runs Then it atomically creates the egg generation and returns a text part", async () => {
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

    const result = await runVpetSpawnCommand(repository, {
      sessionID: "session-1",
      messageID: "vpet-spawn-session-1",
      createdAt: spawned.createdAt,
    })

    expect(calls).toEqual([{ currentNodeId: "0-001", gauge: 0, isTerminal: false, createdAt: spawned.createdAt }])
    expect(result).toEqual({
      parts: [
        {
          id: "vpet-spawn-session-1",
          sessionID: "session-1",
          messageID: "vpet-spawn-session-1",
          type: "text",
          text: "Spawned Generation 2.",
        },
      ],
      event: { kind: "spawned", nodeId: "0-001", generation: 2 },
    })
  })

  test("Given a repository stub When OpenCode dispatches the raw command name Then the hook appends spawn parts only for vpet-spawn", async () => {
    let spawnCalls = 0
    const repository = {
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
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const spawnOutput = { parts: [] as Part[] }
    const unrelatedOutput = { parts: [] as Part[] }

    await hooks["command.execute.before"]?.(
      { command: "vpet-spawn", sessionID: "session-1", arguments: "" },
      spawnOutput,
    )
    await hooks["command.execute.before"]?.(
      { command: "other-command", sessionID: "session-1", arguments: "" },
      unrelatedOutput,
    )

    expect(spawnOutput.parts).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^vpet-vpet-spawn-session-1-/),
        sessionID: "session-1",
        messageID: expect.stringMatching(/^vpet-vpet-spawn-session-1-/),
        type: "text",
        text: "Spawned Generation 2.",
      }),
    ])
    expect(unrelatedOutput.parts).toEqual([])
    expect(spawnCalls).toBe(1)
  })

  test("Given a lifecycle that throws When OpenCode dispatches vpet-spawn Then the error propagates and no success part is appended", () => {
    const failure = new Error("spawn failed")
    const repository = {
      spawnPartner: () => {
        throw failure
      },
      applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
      freeze: () => ({ kind: "frozen" as const }),
      unfreeze: () => ({ kind: "unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const output = { parts: [] as Part[] }
    const handler = hooks["command.execute.before"]
    if (handler === undefined) throw new Error("vpet-spawn command handler is not registered")

    return Promise.resolve(handler({ command: "vpet-spawn", sessionID: "session-1", arguments: "" }, output)).then(
      () => {
        throw new Error("expected spawn lifecycle failure")
      },
      (error: unknown) => {
        expect(error).toBe(failure)
        expect(output.parts).toEqual([])
      },
    )
  })

  test("Given repeated spawn invocations When the hook appends output Then each part ID is invocation-unique", async () => {
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
      freeze: () => ({ kind: "frozen" as const }),
      unfreeze: () => ({ kind: "unfrozen" as const }),
      setCheatNode: (cheatNodeId: string) => ({ kind: "set" as const, cheatNodeId }),
      applyUsageReceipt: () => ({ kind: "no_active_partner" as const }),
    }
    const hooks = createServerHooks({ repository, resource: { close: async () => {} } })
    const first = { parts: [] as Part[] }
    const second = { parts: [] as Part[] }

    await hooks["command.execute.before"]?.({ command: "vpet-spawn", sessionID: "session-1", arguments: "" }, first)
    await hooks["command.execute.before"]?.({ command: "vpet-spawn", sessionID: "session-1", arguments: "" }, second)

    expect(first.parts[0]?.id).not.toBe(second.parts[0]?.id)
  })
})
