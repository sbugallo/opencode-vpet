import { describe, expect, test } from "bun:test"

import { setupVpetServer } from "../src/adapters/opencode/server-plugin.ts"
import type { VpetToastPayload } from "../src/adapters/opencode/vpet-toast.ts"
import type { DigimonCatalog, DigimonNode } from "../src/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { PartnerLifecycle } from "../src/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import type { VpetControl } from "../src/application/ports/vpet-control.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { createServerContextFixture } from "./server-context-fixture.ts"

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
    close: async () => {},
  }) satisfies PartnerLifecycle & UsageLedger & VpetControl & { close(): Promise<void> }

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
    close: async () => {},
  } satisfies PartnerLifecycle & UsageLedger & VpetControl & { close(): Promise<void> }
}

const completedAssistantMessage = (id: string) => ({
  id,
  type: "assistant",
  time: { created: 1, completed: 2 },
  tokens: { input: 10, output: 20, reasoning: 30, cache: { read: 40, write: 50 } },
})

describe("server plugin lifecycle", () => {
  test("Given unrelated events and repeated cleanup When the plugin consumes them Then they produce no usage and close the repository once", async () => {
    let appliedReceiptCount = 0
    let fetchCount = 0
    let closeCount = 0
    const repository = createRepository({ kind: "applied" }, () => {
      appliedReceiptCount += 1
    })
    const repositoryWithClose = {
      ...repository,
      close: async () => {
        closeCount += 1
      },
    }
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => repositoryWithClose,
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      fetchMessages: async () => {
        fetchCount += 1
        return []
      },
    })

    await fixture.dispatch({ type: "session.compacted", data: { sessionID: "session-1" } })
    await cleanup()
    await cleanup()

    expect(appliedReceiptCount).toBe(0)
    expect(fetchCount).toBe(0)
    expect(closeCount).toBe(1)
  })

  test("Given a repository whose close rejects When cleanup is repeated Then the original rejection propagates without a duplicate close", async () => {
    const closeFailure = new Error("resource close failed")
    let closeCount = 0
    const repository = {
      ...createRepository({ kind: "no_active_partner" }),
      close: async (): Promise<void> => {
        closeCount += 1
        throw closeFailure
      },
    }
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => repository,
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
    })

    await Promise.all([
      Promise.resolve(cleanup()).then(
        () => {
          throw new Error("Expected cleanup failure")
        },
        (error: unknown) => expect(error).toBe(closeFailure),
      ),
      Promise.resolve(cleanup()).then(
        () => {
          throw new Error("Expected cleanup failure")
        },
        (error: unknown) => expect(error).toBe(closeFailure),
      ),
    ])
    expect(closeCount).toBe(1)
  })

  test("Given default-enabled command transitions When each command commits Then it delivers exactly one formatted toast", async () => {
    const delivered: VpetToastPayload[] = []
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => createToastRepository(),
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      language: "en",
      loadCatalog: async () => toastCatalog,
      notify: async (payload) => {
        delivered.push(payload)
      },
    })

    await fixture.runCommand("vpet-spawn")
    await fixture.runCommand("vpet-freeze")
    await fixture.runCommand("vpet-unfreeze")
    await fixture.runCommand("vpet-set", "1-001")
    await cleanup()

    expect(delivered).toEqual([
      { title: "VPet", message: "Spawned Digitama (Generation 1).", variant: "success", duration: 5_000 },
      { title: "VPet", message: "Digimon progression frozen.", variant: "info", duration: 3_000 },
      { title: "VPet", message: "Digimon progression resumed.", variant: "info", duration: 3_000 },
      { title: "VPet", message: "VPet set to Koromon (1-001).", variant: "info", duration: 3_000 },
    ])
  })

  test("Given ordered idle evolutions When reconciliation processes them Then each evolution produces one formatted toast in processing order", async () => {
    const delivered: VpetToastPayload[] = []
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => createToastRepository(),
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      language: "en",
      evolutionSelector: () => 0,
      evolutionThresholds: Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1 }),
      loadCatalog: async () => toastCatalog,
      notify: async (payload) => {
        delivered.push(payload)
      },
      fetchMessages: async () => [completedAssistantMessage("message-1"), completedAssistantMessage("message-2")],
    })

    await fixture.dispatch({ type: "session.idle", data: { sessionID: "session-1" } })
    await cleanup()

    expect(delivered).toEqual([
      { title: "Digi-evolution", message: "Digitama evolved into Koromon!", variant: "success", duration: 5_000 },
      { title: "Digi-evolution", message: "Digitama evolved into Koromon!", variant: "success", duration: 5_000 },
    ])
  })

  test("Given notifications disabled When a spawn commits Then egg selection loads the catalog once without notifier work", async () => {
    let catalogLoads = 0
    let notifications = 0
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => createToastRepository(),
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      notificationsEnabled: false,
      loadCatalog: async () => {
        catalogLoads += 1
        return toastCatalog
      },
      notify: async () => {
        notifications += 1
      },
    })

    await fixture.runCommand("vpet-spawn")
    await cleanup()

    expect(catalogLoads).toBe(1)
    expect(notifications).toBe(0)
  })

  test("Given idempotent, invalid, and duplicate paths When they complete Then rich toasts stay silent while plain results inform", async () => {
    const delivered: VpetToastPayload[] = []
    let catalogLoads = 0
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => createRepository({ kind: "duplicate" }),
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      language: "en",
      loadCatalog: async () => {
        catalogLoads += 1
        return toastCatalog
      },
      notify: async (payload) => {
        delivered.push(payload)
      },
      fetchMessages: async () => [completedAssistantMessage("duplicate-message")],
    })

    await fixture.runCommand("vpet-freeze")
    await fixture.runCommand("vpet-set", "missing")
    await fixture.dispatch({ type: "session.idle", data: { sessionID: "session-1" } })
    await cleanup()

    expect(catalogLoads).toBe(2)
    expect(delivered).toEqual([
      { title: "VPet", message: "VPet is already frozen.", variant: "info", duration: 3_000 },
      { title: "VPet", message: "Unknown Digimon ID: missing.", variant: "warning", duration: 3_000 },
    ])
  })

  test.each([
    () => false,
    () => {
      throw new Error("notification failed")
    },
    () => Promise.reject(new Error("notification failed")),
  ])(
    "Given a notifier that fails When a command has committed Then it still resolves after one delivery attempt",
    async (deliver) => {
      let attempts = 0
      const fixture = createServerContextFixture()
      const cleanup = await setupVpetServer(fixture.context, {
        openRepository: async () => createToastRepository(),
        loadSettings: async () => DEFAULT_VPET_SETTINGS,
        notify: async () => {
          attempts += 1
          await deliver()
        },
      })

      await fixture.runCommand("vpet-freeze")
      await cleanup()

      expect(attempts).toBe(1)
    },
  )

  test("Given a toast-only catalog failure after a committed spawn When delivery is attempted Then the spawn remains committed and setup resolves", async () => {
    let spawnCalls = 0
    let catalogLoads = 0
    const delivered: VpetToastPayload[] = []
    const repository = createToastRepository()
    const fixture = createServerContextFixture()
    const cleanup = await setupVpetServer(fixture.context, {
      openRepository: async () => ({
        ...repository,
        spawnPartner: () => {
          spawnCalls += 1
          return repository.spawnPartner()
        },
      }),
      loadSettings: async () => DEFAULT_VPET_SETTINGS,
      loadCatalog: async () => {
        catalogLoads += 1
        // Egg selection succeeds; only the toast name lookup fails.
        if (catalogLoads > 1) throw new Error("catalog unavailable")
        return toastCatalog
      },
      notify: async (payload) => {
        delivered.push(payload)
      },
    })

    await fixture.runCommand("vpet-spawn")
    await cleanup()

    expect(spawnCalls).toBe(1)
    expect(delivered).toEqual([])
  })
})
