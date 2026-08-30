import { describe, expect, test } from "bun:test"
import type { Event } from "@opencode-ai/sdk"

import { createServerHooks } from "../src/adapters/opencode/create-server-hooks.ts"
import type { VpetToastPayload } from "../src/adapters/opencode/vpet-toast.ts"
import type { DigimonCatalog, DigimonNode } from "../src/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { PartnerLifecycle } from "../src/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import type { VpetControl } from "../src/application/ports/vpet-control.ts"

const createRepository = (outcome: ApplyUsageReceiptOutcome, onReceipt?: () => void) =>
  ({
    spawnPartner: () => ({
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      createdAt: "2026-07-31T00:00:00.000Z",
      retiredAt: null,
    }),
    applyUsageReceipt: (_receipt: UsageReceiptMetadata) => {
      onReceipt?.()
      return outcome
    },
    freeze: () => ({ kind: "already_frozen" as const }),
    unfreeze: () => ({ kind: "already_unfrozen" as const }),
    setCheatNode: (cheatNodeId: string) => ({ kind: "already_set" as const, cheatNodeId }),
  }) satisfies PartnerLifecycle & UsageLedger & VpetControl

const toastNodes = [
  {
    id: "0-001",
    nameEn: "Digitama",
    nameJp: "DigiTama",
    nextEvolutions: ["1-001"],
    sprite: "egg",
    stage: 0,
    url: "https://example.test/digitama",
  },
  {
    id: "1-001",
    nameEn: "Koromon",
    nameJp: "Koromon JP",
    nextEvolutions: [],
    sprite: "koromon",
    stage: 1,
    url: "https://example.test/koromon",
  },
] as const satisfies readonly DigimonNode[]

const toastCatalog: DigimonCatalog = { nodes: toastNodes, byId: new Map(toastNodes.map((node) => [node.id, node])) }

const createToastRepository = () => {
  let frozen = false
  let cheatNodeId: string | undefined
  return {
    spawnPartner: () => ({
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      createdAt: "2026-07-31T00:00:00.000Z",
      retiredAt: null,
    }),
    applyUsageReceipt: (
      _receipt: UsageReceiptMetadata,
      evolve: (partner: {
        readonly partnerId: string
        readonly generation: number
        readonly currentNodeId: string
        readonly gauge: number
        readonly isTerminal: boolean
        readonly createdAt: string
        readonly retiredAt: string | null
      }) => { readonly currentNodeId: string; readonly gauge: number; readonly isTerminal: boolean },
    ) => {
      evolve({
        partnerId: "partner-1",
        generation: 1,
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        createdAt: "2026-07-31T00:00:00.000Z",
        retiredAt: null,
      })
      return { kind: "applied" as const }
    },
    freeze: () => {
      if (frozen) return { kind: "already_frozen" as const }
      frozen = true
      return { kind: "frozen" as const }
    },
    unfreeze: () => {
      if (!frozen) return { kind: "already_unfrozen" as const }
      frozen = false
      return { kind: "unfrozen" as const }
    },
    setCheatNode: (nodeId: string) => {
      if (cheatNodeId === nodeId) return { kind: "already_set" as const, cheatNodeId: nodeId }
      cheatNodeId = nodeId
      return { kind: "set" as const, cheatNodeId: nodeId }
    },
  } satisfies PartnerLifecycle & UsageLedger & VpetControl
}

const completedAssistantEvent = {
  type: "message.updated",
  properties: {
    info: {
      id: "message-1",
      sessionID: "session-1",
      role: "assistant",
      time: { created: 1, completed: 2 },
      parentID: "parent-1",
      modelID: "model-1",
      providerID: "provider-1",
      mode: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 10, output: 20, reasoning: 30, cache: { read: 40, write: 50 } },
    },
  },
} satisfies Event

describe("server hook lifecycle", () => {
  test("Given unrelated OpenCode inputs and repeated disposal When hooks dispatch them Then they produce no usage or output and close the outer resource once", async () => {
    let appliedReceiptCount = 0
    let closeCount = 0
    const resource = {
      async close() {
        closeCount += 1
      },
    }
    const hooks = createServerHooks({
      repository: createRepository({ kind: "applied" }, () => {
        appliedReceiptCount += 1
      }),
      resource,
    })
    const eventHandler = hooks.event
    const commandHandler = hooks["command.execute.before"]
    const dispose = hooks.dispose
    const output = { parts: [] }
    if (eventHandler === undefined || commandHandler === undefined || dispose === undefined)
      throw new Error("Expected event, command, and disposal hooks")
    await eventHandler({ event: { type: "session.compacted", properties: { sessionID: "session-1" } } satisfies Event })
    await commandHandler({ command: "unrelated-command", sessionID: "session-1", arguments: "" }, output)
    await dispose()
    await dispose()
    expect(appliedReceiptCount).toBe(0)
    expect(output.parts).toEqual([])
    expect(closeCount).toBe(1)
  })

  test("Given an outer resource whose close rejects When disposal is repeated Then the original rejection propagates without a duplicate close", async () => {
    const closeFailure = new Error("resource close failed")
    let closeCount = 0
    const resource = {
      async close(): Promise<void> {
        closeCount += 1
        throw closeFailure
      },
    }
    const dispose = createServerHooks({ repository: createRepository({ kind: "no_active_partner" }), resource }).dispose
    if (dispose === undefined) throw new Error("Expected disposal hook")
    await Promise.all([
      dispose().then(
        () => {
          throw new Error("Expected disposal failure")
        },
        (error: unknown) => expect(error).toBe(closeFailure),
      ),
      dispose().then(
        () => {
          throw new Error("Expected disposal failure")
        },
        (error: unknown) => expect(error).toBe(closeFailure),
      ),
    ])
    expect(closeCount).toBe(1)
  })

  test("Given default-enabled command transitions When each command commits Then it appends its legacy parts before exactly one formatted toast", async () => {
    const delivered: VpetToastPayload[] = []
    const hooks = createServerHooks({
      repository: createToastRepository(),
      resource: { close: async () => {} },
      language: "en",
      loadCatalog: async () => toastCatalog,
      notify: async (payload) => {
        delivered.push(payload)
      },
    })
    const commandHandler = hooks["command.execute.before"]
    if (commandHandler === undefined) throw new Error("Expected command hook")
    const commands = ["vpet-spawn", "vpet-freeze", "vpet-unfreeze", "vpet-set"] as const

    for (const command of commands) {
      const output = { parts: [] }
      await commandHandler(
        { command, sessionID: "session-1", arguments: command === "vpet-set" ? "1-001" : "" },
        output,
      )
      expect(output.parts).toHaveLength(1)
    }

    expect(delivered).toEqual([
      { title: "VPet", message: "Spawned Digitama (Generation 1).", variant: "success", duration: 5_000 },
      { title: "VPet", message: "Digimon progression frozen.", variant: "info", duration: 3_000 },
      { title: "VPet", message: "Digimon progression resumed.", variant: "info", duration: 3_000 },
      { title: "VPet", message: "VPet set to Koromon (1-001).", variant: "info", duration: 3_000 },
    ])
  })

  test("Given committed direct and ordered idle evolutions When their receipts apply Then each evolution produces one formatted toast in processing order", async () => {
    const delivered: VpetToastPayload[] = []
    const hooks = createServerHooks({
      repository: createToastRepository(),
      resource: { close: async () => {} },
      language: "en",
      evolutionSelector: () => 0,
      evolutionThresholds: Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1 }),
      loadCatalog: async () => toastCatalog,
      notify: async (payload) => {
        delivered.push(payload)
      },
      fetchMessages: async () => [
        completedAssistantEvent.properties.info,
        { ...completedAssistantEvent.properties.info, id: "message-2" },
      ],
    })
    const eventHandler = hooks.event
    if (eventHandler === undefined) throw new Error("Expected event hook")

    await eventHandler({ event: completedAssistantEvent })
    await eventHandler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } satisfies Event })

    expect(delivered).toEqual([
      { title: "Digi-evolution", message: "Digitama evolved into Koromon!", variant: "success", duration: 5_000 },
      { title: "Digi-evolution", message: "Digitama evolved into Koromon!", variant: "success", duration: 5_000 },
      { title: "Digi-evolution", message: "Digitama evolved into Koromon!", variant: "success", duration: 5_000 },
    ])
  })

  test("Given notifications disabled When a name-bearing command commits Then it performs no notifier or catalog work", async () => {
    let catalogLoads = 0
    let notifications = 0
    const hooks = createServerHooks({
      repository: createToastRepository(),
      resource: { close: async () => {} },
      notificationsEnabled: false,
      loadCatalog: async () => {
        catalogLoads += 1
        return toastCatalog
      },
      notify: async () => {
        notifications += 1
      },
    })
    const commandHandler = hooks["command.execute.before"]
    if (commandHandler === undefined) throw new Error("Expected command hook")

    await commandHandler({ command: "vpet-spawn", sessionID: "session-1", arguments: "" }, { parts: [] })

    expect(catalogLoads).toBe(0)
    expect(notifications).toBe(0)
  })

  test("Given idempotent, invalid, duplicate, and missing-name paths When hooks complete Then they remain silent while preserving their committed result", async () => {
    const delivered: VpetToastPayload[] = []
    const hooks = createServerHooks({
      repository: createRepository({ kind: "duplicate" }),
      resource: { close: async () => {} },
      language: "en",
      loadCatalog: async () => toastCatalog,
      notify: async (payload) => {
        delivered.push(payload)
      },
    })
    const commandHandler = hooks["command.execute.before"]
    const eventHandler = hooks.event
    if (commandHandler === undefined || eventHandler === undefined) throw new Error("Expected command and event hooks")
    const output = { parts: [] }

    await commandHandler({ command: "vpet-freeze", sessionID: "session-1", arguments: "" }, output)
    await commandHandler({ command: "vpet-set", sessionID: "session-1", arguments: "missing" }, output)
    await eventHandler({ event: completedAssistantEvent })

    expect(output.parts).toHaveLength(2)
    expect(delivered).toEqual([])
  })

  test.each([
    () => false,
    () => {
      throw new Error("notification failed")
    },
    () => Promise.reject(new Error("notification failed")),
  ])(
    "Given a notifier that fails When a command has committed Then it still resolves after the exact text Part is appended",
    async (deliver) => {
      const hooks = createServerHooks({
        repository: createToastRepository(),
        resource: { close: async () => {} },
        notify: async () => {
          await deliver()
        },
      })
      const commandHandler = hooks["command.execute.before"]
      if (commandHandler === undefined) throw new Error("Expected command hook")
      const output = { parts: [] }

      await commandHandler({ command: "vpet-freeze", sessionID: "session-1", arguments: "" }, output)

      expect(output.parts).toHaveLength(1)
    },
  )

  test("Given a toast-only catalog failure after a committed spawn When delivery is attempted Then the Part remains and the hook resolves", async () => {
    const hooks = createServerHooks({
      repository: createToastRepository(),
      resource: { close: async () => {} },
      loadCatalog: async () => {
        throw new Error("catalog unavailable")
      },
    })
    const commandHandler = hooks["command.execute.before"]
    if (commandHandler === undefined) throw new Error("Expected command hook")
    const output = { parts: [] }

    await commandHandler({ command: "vpet-spawn", sessionID: "session-1", arguments: "" }, output)

    expect(output.parts).toHaveLength(1)
  })
})
