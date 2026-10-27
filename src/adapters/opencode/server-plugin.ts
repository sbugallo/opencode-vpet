import type { Plugin } from "@opencode/plugin"

import type { UsageProcessingResult } from "../../application/models/usage.ts"
import type { PartnerLifecycle } from "../../application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../../application/ports/usage-ledger.ts"
import type { VpetControl } from "../../application/ports/vpet-control.ts"
import { reconcileUsage } from "../../application/use-cases/reconcile-usage.ts"
import type { VpetCommandEvent, VpetCommandResult } from "../../commands/vpet-command-result.ts"
import { runVpetFreezeCommand } from "../../commands/vpet-freeze.ts"
import { runVpetSetCommand } from "../../commands/vpet-set.ts"
import { DIGITAMA_FIELDS, runVpetSpawnCommand } from "../../commands/vpet-spawn.ts"
import { runVpetUnfreezeCommand } from "../../commands/vpet-unfreeze.ts"
import { loadGlobalVpetSettings } from "../../config/global-vpet-settings.ts"
import type { ResolvedVpetSettings, VpetLanguage } from "../../config/types.ts"
import { loadDigimonCatalog, type DigimonCatalog } from "../../data/catalog.ts"
import type { EvolutionSelector, StageThresholds } from "../../domain/evolution.ts"
import { VpetRpc } from "../../rpc.ts"
import { createSessionMessagesFetcher, type SessionMessagesFetcher } from "./session-messages.ts"
import { toCompletedUsageFromMessage } from "./usage-event-mapper.ts"
import {
  createBestEffortVpetToastNotifier,
  formatVpetToast,
  type VpetToastEvent,
  type VpetToastNotifier,
} from "./vpet-toast.ts"

export type ServerResource = {
  close(): Promise<void>
}

export type ServerRepository = PartnerLifecycle & UsageLedger & VpetControl & ServerResource

export type ServerContext = Pick<Plugin.Context, "options" | "command" | "event" | "rpc" | "session">

export type ServerEventSource = {
  subscribe(options: { readonly signal: AbortSignal }): AsyncIterable<{
    readonly type: string
    readonly data: unknown
  }>
}

export type ServerCommandDefinition = {
  readonly name: string
  readonly description: string
  readonly execute: (input: { readonly prompt: { readonly text: string } }) => Promise<void>
}

export type ServerRepositoryInput = {
  readonly appDataRoot?: string
  readonly databasePath?: string
}

export type ServerDependencies = {
  readonly openRepository: (input: ServerRepositoryInput) => Promise<ServerRepository>
  readonly loadSettings?: () => Promise<ResolvedVpetSettings>
  readonly loadCatalog?: () => Promise<DigimonCatalog>
  readonly evolutionSelector?: EvolutionSelector
  readonly evolutionThresholds?: StageThresholds
  readonly language?: VpetLanguage
  readonly notificationsEnabled?: boolean
  readonly notify?: VpetToastNotifier
  readonly fetchMessages?: SessionMessagesFetcher
}

const noOpNotifier: VpetToastNotifier = async () => {}
const EMPTY_CATALOG: DigimonCatalog = Object.freeze({ nodes: Object.freeze([]), byId: new Map() })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const getStringOption = (options: Readonly<Record<string, unknown>>, name: string): string | undefined => {
  const value = options[name]
  return typeof value === "string" ? value : undefined
}

const toEvolutionThresholds = (settings: ResolvedVpetSettings): StageThresholds =>
  Object.freeze({ ...settings.stageThresholds })

const toToastEvent = (result: UsageProcessingResult): VpetToastEvent | undefined => {
  switch (result.kind) {
    case "applied":
      return result.evolution === undefined ? undefined : { kind: "evolution", ...result.evolution }
    case "duplicate":
    case "no_active_partner":
      return undefined
    default: {
      const unexpectedResult: never = result
      return unexpectedResult
    }
  }
}

const toCommandToastEvent = (event: VpetCommandEvent): VpetToastEvent => {
  switch (event.kind) {
    case "spawned":
      return { kind: "spawn", nodeId: event.nodeId, generation: event.generation }
    case "frozen":
      return { kind: "freeze" }
    case "unfrozen":
      return { kind: "unfreeze" }
    case "set":
      return { kind: "set", nodeId: event.nodeId }
  }
}

const requiresCatalog = (event: VpetToastEvent): boolean => {
  switch (event.kind) {
    case "spawn":
    case "set":
    case "evolution":
      return true
    case "freeze":
    case "unfreeze":
      return false
  }
}

const spawnFieldDescription = (field: string): string =>
  `Spawn a Digiegg of the ${field
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")} field.`

export const createCommandConfig = () => ({
  "vpet-spawn": { description: "Spawn a new virtual pet." },
  ...Object.fromEntries(
    DIGITAMA_FIELDS.map((field) => [`vpet-spawn-${field}`, { description: spawnFieldDescription(field) }]),
  ),
  "vpet-freeze": { description: "Freeze virtual pet progression." },
  "vpet-unfreeze": { description: "Unfreeze virtual pet progression." },
  "vpet-set": { description: "Set the virtual pet to a Digimon ID." },
})

const toEventSessionID = (data: unknown): string | undefined => {
  if (!isRecord(data)) return undefined
  const { sessionID } = data
  return typeof sessionID === "string" && sessionID.length > 0 ? sessionID : undefined
}

/** Narrows a v2 event to the sessions whose completed usage should be reconciled. */
export const toReconcileSessionID = (event: unknown): string | undefined => {
  if (!isRecord(event)) return undefined
  const { type, data } = event
  if (typeof type !== "string") return undefined
  switch (type) {
    case "session.execution.succeeded":
    case "session.idle":
      return toEventSessionID(data)
    case "session.status": {
      if (!isRecord(data)) return undefined
      const { status } = data
      if (!isRecord(status)) return undefined
      const { type: statusType } = status
      if (statusType !== "idle") return undefined
      return toEventSessionID(data)
    }
    default:
      return undefined
  }
}

export type ServerReconcile = (messages: readonly unknown[]) => Promise<void>

export const consumeVpetSessionEvents = async (input: {
  readonly event: ServerEventSource
  readonly signal: AbortSignal
  readonly fetchMessages: SessionMessagesFetcher
  readonly reconcile: ServerReconcile
}): Promise<void> => {
  for await (const event of input.event.subscribe({ signal: input.signal })) {
    const sessionID = toReconcileSessionID(event)
    if (sessionID === undefined) continue
    const messages = await input.fetchMessages(sessionID)
    await input.reconcile(messages)
  }
}

export type VpetCommandDefinitionDependencies = {
  readonly repository: ServerRepository
  readonly emit: (result: VpetCommandResult, catalog?: DigimonCatalog) => Promise<void>
  readonly loadCatalog: () => Promise<DigimonCatalog>
}

export const createVpetCommandDefinitions = ({
  repository,
  emit,
  loadCatalog,
}: VpetCommandDefinitionDependencies): readonly ServerCommandDefinition[] => {
  const config = createCommandConfig()

  return [
    {
      name: "vpet-spawn",
      description: config["vpet-spawn"].description,
      execute: async ({ prompt }) => {
        await emit(
          await runVpetSpawnCommand(
            repository,
            { arguments: prompt.text, createdAt: new Date().toISOString() },
            loadCatalog,
          ),
        )
      },
    },
    ...DIGITAMA_FIELDS.map((field) => ({
      name: `vpet-spawn-${field}`,
      description: spawnFieldDescription(field),
      execute: async () => {
        await emit(
          await runVpetSpawnCommand(repository, { arguments: field, createdAt: new Date().toISOString() }, loadCatalog),
        )
      },
    })),
    {
      name: "vpet-freeze",
      description: config["vpet-freeze"].description,
      execute: async () => {
        await emit(await runVpetFreezeCommand(repository))
      },
    },
    {
      name: "vpet-unfreeze",
      description: config["vpet-unfreeze"].description,
      execute: async () => {
        await emit(await runVpetUnfreezeCommand(repository))
      },
    },
    {
      name: "vpet-set",
      description: config["vpet-set"].description,
      execute: async ({ prompt }) => {
        let catalog: DigimonCatalog | undefined
        const loadCommandCatalog = async (): Promise<DigimonCatalog> => (catalog ??= await loadCatalog())
        const result = await runVpetSetCommand(repository, { arguments: prompt.text }, loadCommandCatalog)
        await emit(result, result.event === undefined ? undefined : await loadCommandCatalog())
      },
    },
  ]
}

export const setupVpetServer = async (
  context: ServerContext,
  dependencies: ServerDependencies,
): Promise<Plugin.Cleanup> => {
  const appDataRoot = getStringOption(context.options, "appDataRoot")
  const databasePath = getStringOption(context.options, "databasePath")
  const settings = await (dependencies.loadSettings ?? loadGlobalVpetSettings)()
  const repository = await dependencies.openRepository({
    ...(appDataRoot === undefined ? {} : { appDataRoot }),
    ...(databasePath === undefined ? {} : { databasePath }),
  })

  try {
    const language = dependencies.language ?? settings.language
    const notificationsEnabled = dependencies.notificationsEnabled ?? settings.notifications
    const evolutionSelector = dependencies.evolutionSelector ?? Math.random
    const evolutionThresholds = dependencies.evolutionThresholds ?? toEvolutionThresholds(settings)
    const loadCatalog = dependencies.loadCatalog ?? loadDigimonCatalog
    const fetchMessages = dependencies.fetchMessages ?? createSessionMessagesFetcher(context)

    let notify: VpetToastNotifier = dependencies.notify ?? noOpNotifier
    if (dependencies.notify === undefined && notificationsEnabled) {
      const registration = await context.rpc.register(VpetRpc, {})
      notify = createBestEffortVpetToastNotifier(async (payload) => {
        await registration.events.emit("toast", payload)
      })
    }

    const notifyEvent = async (event: VpetToastEvent, catalog?: DigimonCatalog): Promise<void> => {
      if (!notificationsEnabled) return
      await Promise.resolve()
        .then(async () => {
          const resolvedCatalog = catalog ?? (requiresCatalog(event) ? await loadCatalog() : EMPTY_CATALOG)
          const payload = formatVpetToast(event, language, resolvedCatalog)
          if (payload !== undefined) await notify(payload)
        })
        .then(
          () => undefined,
          () => undefined,
        )
    }

    const emit = async (result: VpetCommandResult, catalog?: DigimonCatalog): Promise<void> => {
      if (result.event !== undefined) {
        await notifyEvent(toCommandToastEvent(result.event), catalog)
        return
      }
      if (!notificationsEnabled) return
      await Promise.resolve()
        .then(() => notify({ title: "VPet", message: result.message, variant: result.variant, duration: 3_000 }))
        .then(
          () => undefined,
          () => undefined,
        )
    }

    const definitions = createVpetCommandDefinitions({ repository, emit, loadCatalog })
    await context.command.transform((editor) => {
      for (const definition of definitions) editor.add(definition)
    })

    const usageAbortController = new AbortController()
    let reconciliationFailed = false
    let reconciliationFailure: unknown
    const reconciliation = consumeVpetSessionEvents({
      event: context.event,
      signal: usageAbortController.signal,
      fetchMessages,
      reconcile: async (messages) => {
        const usages = messages.flatMap((message) => {
          const usage = toCompletedUsageFromMessage(message)
          return usage === null ? [] : [usage]
        })
        if (usages.length === 0) return
        const catalog = await loadCatalog()
        const results = reconcileUsage({
          usages,
          ledger: repository,
          digimonById: catalog.byId,
          selector: evolutionSelector,
          thresholds: evolutionThresholds,
        })
        for (const result of results) {
          const toastEvent = toToastEvent(result)
          if (toastEvent !== undefined) await notifyEvent(toastEvent, catalog)
        }
      },
    }).catch((error: unknown) => {
      reconciliationFailed = true
      reconciliationFailure = error
    })

    let closePromise: Promise<void> | undefined
    const closeRepository = (): Promise<void> => (closePromise ??= repository.close())

    return async () => {
      usageAbortController.abort()
      await reconciliation
      let closeFailure: unknown
      try {
        await closeRepository()
      } catch (error) {
        closeFailure = error
      }
      if (reconciliationFailed && closeFailure !== undefined) {
        throw new AggregateError(
          [reconciliationFailure, closeFailure],
          "VPet usage reconciliation and repository cleanup failed.",
        )
      }
      if (reconciliationFailed) throw reconciliationFailure
      if (closeFailure !== undefined) throw closeFailure
    }
  } catch (setupFailure) {
    try {
      await repository.close()
    } catch (closeFailure) {
      throw new AggregateError([setupFailure, closeFailure], "VPet setup and repository cleanup failed.")
    }
    throw setupFailure
  }
}
