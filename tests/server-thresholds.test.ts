import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, posix } from "node:path"

import { setupVpetServer, type ServerDependencies } from "../src/adapters/opencode/server-plugin.ts"
import type { UsageReceiptMetadata } from "../src/application/models/usage.ts"
import type { PartnerLifecycle } from "../src/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../src/application/ports/usage-ledger.ts"
import type { VpetControl } from "../src/application/ports/vpet-control.ts"
import { createSqliteVpetRepository } from "../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { STAGE_GAUGE_THRESHOLDS, type StageThresholds } from "../src/domain/evolution.ts"
import type { Partner, PartnerProgression } from "../src/domain/partner.ts"
import { loadGlobalVpetSettings, resolveGlobalVpetConfigPath } from "../src/config/global-vpet-settings.ts"
import { isBunSqliteAvailable } from "./sqlite-capability.ts"
import { createServerContextFixture } from "./server-context-fixture.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-vpet-server-thresholds-"))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const completedAssistantMessage = (id: string) => ({
  id,
  type: "assistant",
  time: { created: 1, completed: 2 },
  tokens: { input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

type TestRepository = PartnerLifecycle &
  UsageLedger &
  VpetControl & { readonly progressions: PartnerProgression[]; close(): Promise<void> }

const createRepository = (partner: Partner): TestRepository => {
  const progressions: PartnerProgression[] = []

  return {
    progressions,
    close: async () => {},
    spawnPartner: () => partner,
    applyUsageReceipt(_receipt: UsageReceiptMetadata, evolve) {
      progressions.push(evolve(partner))
      return { kind: "applied" }
    },
    freeze: () => ({ kind: "already_frozen" }),
    unfreeze: () => ({ kind: "already_unfrozen" }),
    setCheatNode: (cheatNodeId) => ({ kind: "already_set", cheatNodeId }),
  }
}

const reconcile = async (
  repository: TestRepository,
  dependencies: Omit<ServerDependencies, "openRepository">,
): Promise<void> => {
  const fixture = createServerContextFixture()
  const cleanup = await setupVpetServer(fixture.context, {
    loadSettings: async () => DEFAULT_VPET_SETTINGS,
    ...dependencies,
    openRepository: async () => repository,
  })

  await fixture.dispatch({ type: "session.idle", data: { sessionID: "session-1" } })
  await cleanup()
}

const childThresholds: StageThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 3: 1 })

const runPluginWithConfigHome = async (
  configHome: string,
  appDataRoot: string,
  updatedThreshold?: number,
): Promise<void> => {
  const processResult = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { plugin } from "./src/index.ts"

const message = {
  id: "plugin-message",
  type: "assistant",
  time: { created: 1, completed: 2 },
  tokens: { input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
}
let release
const released = new Promise((resolve) => {
  release = resolve
})
const context = {
  options: { appDataRoot: process.env["VPET_APP_DATA_ROOT"] },
  command: {
    transform: async (callback) => {
      const definitions = []
      callback({ add: (definition) => definitions.push(definition) })
      context.definitions = definitions
      return { dispose: async () => {} }
    },
    definitions: [],
  },
  event: {
    subscribe: () => ({
      async *[Symbol.asyncIterator]() {
        await released
        yield { type: "session.idle", data: { sessionID: "session-1" } }
      },
    }),
  },
  rpc: { register: async () => ({ events: { emit: async () => {} } }) },
  session: { context: async () => [message] },
}
const cleanup = await plugin.setup(context)
const spawn = context.definitions.find((definition) => definition.name === "vpet-spawn")
if (spawn === undefined) throw new Error("Expected vpet-spawn command")
await spawn.execute({ prompt: { text: "" } })
if (process.env["VPET_UPDATED_THRESHOLD"] !== undefined) {
  await writeFile(
    join(process.env["HOME"] ?? "", ".config", "opencode-vpet.json"),
    JSON.stringify({ stageThresholds: { egg: Number(process.env["VPET_UPDATED_THRESHOLD"]) } }),
  )
}
release()
await cleanup()`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: configHome,
        VPET_APP_DATA_ROOT: appDataRoot,
        ...(updatedThreshold === undefined ? {} : { VPET_UPDATED_THRESHOLD: String(updatedThreshold) }),
      },
      stderr: "pipe",
    },
  )
  const exitCode = await processResult.exited

  if (exitCode !== 0) throw new Error(await new Response(processResult.stderr).text())
}

describe("server threshold policy", () => {
  test("Given an injected HOME value When resolving without an explicit home Then the native home directory remains authoritative", () => {
    const injectedHome = "/temporary/injected-home"

    expect(
      resolveGlobalVpetConfigPath({
        env: { HOME: injectedHome },
        pathApi: posix,
        platform: "linux",
      }),
    ).toBe(posix.join(homedir(), ".config", "opencode-vpet.json"))
  })

  test("Given a controlled child threshold When idle usage arrives Then it evolves from the supplied policy", async () => {
    const partner: Partner = {
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt: "2026-08-21T00:00:00.000Z",
      retiredAt: null,
    }
    const repository = createRepository(partner)

    await reconcile(repository, {
      evolutionSelector: () => 0,
      evolutionThresholds: childThresholds,
      fetchMessages: async () => [completedAssistantMessage("idle-message")],
    })

    expect(repository.progressions).toEqual([expect.objectContaining({ gauge: 0, isTerminal: false })])
    expect(repository.progressions[0]?.currentNodeId).not.toBe(partner.currentNodeId)
  })

  test("Given default thresholds When idle usage arrives below the child threshold Then the existing timing is retained", async () => {
    const partner: Partner = {
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt: "2026-08-21T00:00:00.000Z",
      retiredAt: null,
    }
    const repository = createRepository(partner)

    await reconcile(repository, {
      evolutionSelector: () => 0,
      fetchMessages: async () => [completedAssistantMessage("default-message")],
    })

    expect(repository.progressions).toEqual([
      {
        currentNodeId: partner.currentNodeId,
        gauge: 1,
        isTerminal: false,
      },
    ])
  })

  test("Given a threshold file changed after settings load When loading it once Then the original snapshot remains active", async () => {
    const root = await createTempRoot()
    const configDirectory = join(root, ".config")
    const configPath = join(configDirectory, "opencode-vpet.json")
    await mkdir(configDirectory)
    await writeFile(configPath, JSON.stringify({ stageThresholds: { child: 2 } }))
    const settings = await loadGlobalVpetSettings({ home: root })
    await writeFile(configPath, JSON.stringify({ stageThresholds: { child: 1 } }))

    expect(settings.stageThresholds.child).toBe(2)
  })

  test.if(isBunSqliteAvailable)(
    "Given a controlled config file When the actual server plugin handles usage Then it applies the configured startup threshold",
    async () => {
      const configRoot = await createTempRoot()
      const appDataRoot = await createTempRoot()
      const configDirectory = join(configRoot, ".config")
      await mkdir(configDirectory)
      await writeFile(join(configDirectory, "opencode-vpet.json"), JSON.stringify({ stageThresholds: { egg: 1 } }))
      await runPluginWithConfigHome(configRoot, appDataRoot)

      const repository = await createSqliteVpetRepository({
        databasePath: join(appDataRoot, "opencode-vpet", "pet.db"),
      })
      try {
        expect(repository.getActivePartner()?.gauge).toBe(0)
      } finally {
        await repository.close()
      }
    },
  )

  test.if(isBunSqliteAvailable)(
    "Given a config file changed after actual plugin initialization When usage arrives Then the plugin keeps its startup threshold snapshot",
    async () => {
      const configRoot = await createTempRoot()
      const appDataRoot = await createTempRoot()
      const configDirectory = join(configRoot, ".config")
      const configPath = join(configDirectory, "opencode-vpet.json")
      await mkdir(configDirectory)
      await writeFile(configPath, JSON.stringify({ stageThresholds: { egg: 1 } }))
      await runPluginWithConfigHome(configRoot, appDataRoot, 2)

      const repository = await createSqliteVpetRepository({
        databasePath: join(appDataRoot, "opencode-vpet", "pet.db"),
      })
      try {
        expect(repository.getActivePartner()?.gauge).toBe(0)
      } finally {
        await repository.close()
      }
    },
  )
})
