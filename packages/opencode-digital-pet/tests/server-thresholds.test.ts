import { afterEach, describe, expect, test } from "bun:test"
import type { AssistantMessage, Event } from "@opencode-ai/sdk"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, posix } from "node:path"

import { createServerHooks, type ServerHookDependencies } from "../src/adapters/opencode/create-server-hooks.ts"
import { createSessionMessagesFetcher } from "../src/adapters/opencode/session-messages.ts"
import type { UsageReceiptMetadata } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { PartnerLifecycle } from "@jcendal/digital-pet-core/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "@jcendal/digital-pet-core/application/ports/usage-ledger.ts"
import type { DigitalPetControl } from "@jcendal/digital-pet-core/application/ports/digital-pet-control.ts"
import { createSqliteDigitalPetRepository } from "../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { STAGE_GAUGE_THRESHOLDS, type StageThresholds } from "@jcendal/digital-pet-core/domain/evolution.ts"
import type { Partner, PartnerProgression } from "@jcendal/digital-pet-core/domain/partner.ts"
import {
  loadGlobalDigitalPetSettings,
  resolveGlobalDigitalPetConfigPath,
} from "../src/config/global-digital-pet-settings.ts"
import { isBunSqliteAvailable } from "./sqlite-capability.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-digital-pet-server-thresholds-"))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const completedAssistantMessage = (id: string): AssistantMessage => ({
  id,
  sessionID: "session-1",
  role: "assistant",
  time: { created: 1, completed: 2 },
  parentID: "parent-1",
  modelID: "model-1",
  providerID: "provider-1",
  mode: "build",
  path: { cwd: "/tmp", root: "/tmp" },
  cost: 0,
  tokens: { input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

type TestRepository = PartnerLifecycle &
  UsageLedger &
  DigitalPetControl & { readonly progressions: PartnerProgression[] }

const createRepository = (partner: Partner): TestRepository => {
  const progressions: PartnerProgression[] = []

  return {
    progressions,
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

const dispatch = async (hooks: ReturnType<typeof createServerHooks>, event: Event): Promise<void> => {
  const handler = hooks.event
  if (handler === undefined) throw new Error("Expected usage event hook")
  await handler({ event })
}

const createHooks = (dependencies: ServerHookDependencies): ReturnType<typeof createServerHooks> =>
  createServerHooks(dependencies)

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
      `import { createOpencodeClient } from "@opencode-ai/sdk"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { plugin } from "./src/index.ts"

const hooks = await plugin({
  client: createOpencodeClient(),
  project: { id: "project-1", worktree: "/tmp", time: { created: 0 } },
  directory: "/tmp",
  worktree: "/tmp",
  experimental_workspace: { register: () => {} },
  serverUrl: new URL("http://localhost"),
  $: Bun.$,
}, { appDataRoot: process.env["DIGITAL_PET_APP_DATA_ROOT"] })
const command = hooks["command.execute.before"]
if (command === undefined) throw new Error("Expected spawn command hook")
await command({ command: "digital-pet-spawn", sessionID: "session-1", arguments: "" }, { parts: [] })
if (process.env["DIGITAL_PET_UPDATED_THRESHOLD"] !== undefined) {
  await writeFile(join(process.env["HOME"] ?? "", ".config", "opencode-digital-pet.json"), JSON.stringify({ stageThresholds: { egg: Number(process.env["DIGITAL_PET_UPDATED_THRESHOLD"]) } }))
}
const handler = hooks.event
if (handler === undefined) throw new Error("Expected usage event hook")
await handler({ event: {
  type: "message.updated",
  properties: { info: {
    id: "plugin-message",
    sessionID: "session-1",
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "parent-1",
    modelID: "model-1",
    providerID: "provider-1",
    mode: "build",
    path: { cwd: "/tmp", root: "/tmp" },
    cost: 0,
    tokens: { input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  } },
} })
await hooks.dispose?.()`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: configHome,
        DIGITAL_PET_APP_DATA_ROOT: appDataRoot,
        ...(updatedThreshold === undefined ? {} : { DIGITAL_PET_UPDATED_THRESHOLD: String(updatedThreshold) }),
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
      resolveGlobalDigitalPetConfigPath({
        env: { HOME: injectedHome },
        pathApi: posix,
        platform: "linux",
      }),
    ).toBe(posix.join(homedir(), ".config", "opencode-digital-pet.json"))
  })

  test("Given a controlled child threshold When direct and idle usage arrive Then both paths evolve from the same supplied policy", async () => {
    const partner: Partner = {
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      retiredAt: null,
    }
    const directRepository = createRepository(partner)
    const idleRepository = createRepository(partner)
    const directHooks = createHooks({
      repository: directRepository,
      resource: { close: async () => {} },
      evolutionSelector: () => 0,
      evolutionThresholds: childThresholds,
    })
    const idleHooks = createHooks({
      repository: idleRepository,
      resource: { close: async () => {} },
      evolutionSelector: () => 0,
      evolutionThresholds: childThresholds,
      fetchMessages: createSessionMessagesFetcher({
        session: { messages: async () => ({ data: [{ info: completedAssistantMessage("idle-message"), parts: [] }] }) },
      }),
    })

    await dispatch(directHooks, {
      type: "message.updated",
      properties: { info: completedAssistantMessage("direct-message") },
    } satisfies Event)
    await dispatch(idleHooks, { type: "session.idle", properties: { sessionID: "session-1" } } satisfies Event)

    expect(directRepository.progressions).toEqual(idleRepository.progressions)
    expect(directRepository.progressions).toEqual([
      expect.objectContaining({
        currentNodeId: partner.currentNodeId,
        gauge: 1,
        isTerminal: false,
        pendingEvolutionTargetId: expect.any(String),
        battleOpponentNodeId: expect.any(String),
      }),
    ])
  })

  test("Given default thresholds When direct usage arrives below the child threshold Then the existing timing is retained", async () => {
    const partner: Partner = {
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      retiredAt: null,
    }
    const repository = createRepository(partner)
    const hooks = createHooks({ repository, resource: { close: async () => {} }, evolutionSelector: () => 0 })

    await dispatch(hooks, {
      type: "message.updated",
      properties: { info: completedAssistantMessage("default-message") },
    } satisfies Event)

    expect(repository.progressions).toEqual([
      {
        currentNodeId: partner.currentNodeId,
        gauge: 1,
        isTerminal: false,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
    ])
  })

  test("Given a threshold file changed after hook construction When loading it once Then the original snapshot remains active", async () => {
    const root = await createTempRoot()
    const configDirectory = join(root, ".config")
    const configPath = join(configDirectory, "opencode-digital-pet.json")
    await mkdir(configDirectory)
    await writeFile(configPath, JSON.stringify({ stageThresholds: { child: 2 } }))
    const settings = await loadGlobalDigitalPetSettings({ home: root })
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
      await writeFile(
        join(configDirectory, "opencode-digital-pet.json"),
        JSON.stringify({ stageThresholds: { egg: 1 } }),
      )
      await runPluginWithConfigHome(configRoot, appDataRoot)

      const repository = await createSqliteDigitalPetRepository({
        databasePath: join(appDataRoot, "opencode-digital-pet", "pet.db"),
      })
      try {
        const partner = repository.getActivePartner()
        expect(partner).not.toBeNull()
        expect(partner).toEqual(
          expect.objectContaining({
            gauge: 0,
            pendingEvolutionTargetId: null,
            battleOpponentNodeId: null,
          }),
        )
        expect(partner?.currentNodeId).toMatch(/^1-/)
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
      const configPath = join(configDirectory, "opencode-digital-pet.json")
      await mkdir(configDirectory)
      await writeFile(configPath, JSON.stringify({ stageThresholds: { egg: 1 } }))
      await runPluginWithConfigHome(configRoot, appDataRoot, 2)

      const repository = await createSqliteDigitalPetRepository({
        databasePath: join(appDataRoot, "opencode-digital-pet", "pet.db"),
      })
      try {
        const partner = repository.getActivePartner()
        expect(partner).not.toBeNull()
        expect(partner).toEqual(
          expect.objectContaining({
            gauge: 0,
            pendingEvolutionTargetId: null,
            battleOpponentNodeId: null,
          }),
        )
        expect(partner?.currentNodeId).toMatch(/^1-/)
      } finally {
        await repository.close()
      }
    },
  )
})
