import type { Hooks } from "@opencode-ai/plugin"

import { runVpetFreezeCommand } from "../../commands/vpet-freeze.ts"
import { runVpetSpawnCommand } from "../../commands/vpet-spawn.ts"
import { runVpetSetCommand } from "../../commands/vpet-set.ts"
import { runVpetUnfreezeCommand } from "../../commands/vpet-unfreeze.ts"
import type { VpetCommandEvent } from "../../commands/vpet-command-result.ts"
import { loadDigimonCatalog } from "../../data/catalog.ts"
import type { VpetLanguage } from "../../config/types.ts"
import type { DigimonCatalog } from "../../data/catalog.ts"
import type { PartnerLifecycle } from "../../application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../../application/ports/usage-ledger.ts"
import type { VpetControl } from "../../application/ports/vpet-control.ts"
import type { UsageProcessingResult } from "../../application/models/usage.ts"
import { reconcileUsage } from "../../application/use-cases/reconcile-usage.ts"
import { recordUsage } from "../../application/use-cases/record-usage.ts"
import { STAGE_GAUGE_THRESHOLDS, type EvolutionSelector, type StageThresholds } from "../../domain/evolution.ts"
import type { SessionMessagesFetcher } from "./session-messages.ts"
import { toCompletedUsageFromEvent, toCompletedUsageFromMessage } from "./usage-event-mapper.ts"
import { formatVpetToast, type VpetToastEvent, type VpetToastNotifier } from "./vpet-toast.ts"

export type ServerResource = {
  close(): Promise<void>
}

export type ServerHookDependencies = {
  readonly repository: PartnerLifecycle & UsageLedger & VpetControl
  readonly resource: ServerResource
  readonly evolutionSelector?: EvolutionSelector
  readonly evolutionThresholds?: StageThresholds
  readonly fetchMessages?: SessionMessagesFetcher
  readonly language?: VpetLanguage
  readonly notificationsEnabled?: boolean
  readonly loadCatalog?: () => Promise<DigimonCatalog>
  readonly notify?: VpetToastNotifier
}

const noOpNotifier: VpetToastNotifier = async () => {}
const EMPTY_CATALOG: DigimonCatalog = Object.freeze({ nodes: Object.freeze([]), byId: new Map() })

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

export const createCommandConfig = () => ({
  "vpet-spawn": { template: "Spawn a new virtual pet." },
  "vpet-freeze": { template: "Freeze virtual pet progression." },
  "vpet-unfreeze": { template: "Unfreeze virtual pet progression." },
  "vpet-set": { template: "Set the virtual pet to a Digimon ID: $ARGUMENTS" },
})

export const createServerHooks = ({
  repository,
  resource,
  evolutionSelector = Math.random,
  evolutionThresholds = STAGE_GAUGE_THRESHOLDS,
  fetchMessages,
  language = "jp",
  notificationsEnabled = true,
  loadCatalog = loadDigimonCatalog,
  notify = noOpNotifier,
}: ServerHookDependencies): Hooks => {
  let closePromise: Promise<void> | undefined

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

  return {
    async config(config) {
      config.command = {
        ...config.command,
        ...createCommandConfig(),
      }
    },
    async "command.execute.before"(input, output) {
      const messageID = `vpet-${input.command}-${input.sessionID}-${crypto.randomUUID()}`
      switch (input.command) {
        case "vpet-spawn":
          {
            const result = await runVpetSpawnCommand(repository, {
              sessionID: input.sessionID,
              messageID,
              createdAt: new Date().toISOString(),
            })
            output.parts.push(...result.parts)
            if (result.event !== undefined) await notifyEvent(toCommandToastEvent(result.event))
          }
          return
        case "vpet-freeze":
          {
            const result = await runVpetFreezeCommand(repository, { sessionID: input.sessionID, messageID })
            output.parts.push(...result.parts)
            if (result.event !== undefined) await notifyEvent(toCommandToastEvent(result.event))
          }
          return
        case "vpet-unfreeze":
          {
            const result = await runVpetUnfreezeCommand(repository, { sessionID: input.sessionID, messageID })
            output.parts.push(...result.parts)
            if (result.event !== undefined) await notifyEvent(toCommandToastEvent(result.event))
          }
          return
        case "vpet-set":
          {
            let catalog: DigimonCatalog | undefined
            const loadCommandCatalog = async (): Promise<DigimonCatalog> => (catalog ??= await loadCatalog())
            const result = await runVpetSetCommand(
              repository,
              { sessionID: input.sessionID, messageID, arguments: input.arguments },
              loadCommandCatalog,
            )
            output.parts.push(...result.parts)
            if (result.event !== undefined)
              await notifyEvent(toCommandToastEvent(result.event), await loadCommandCatalog())
          }
          return
        default:
          return
      }
    },
    async event({ event }) {
      switch (event.type) {
        case "message.updated": {
          const usage = toCompletedUsageFromEvent(event)
          if (usage === null) return
          const catalog = await loadCatalog()
          const result = recordUsage({
            usage,
            ledger: repository,
            digimonById: catalog.byId,
            selector: evolutionSelector,
            thresholds: evolutionThresholds,
          })
          const toastEvent = toToastEvent(result)
          if (toastEvent !== undefined) await notifyEvent(toastEvent, catalog)
          return
        }
        case "session.idle": {
          if (fetchMessages === undefined) return
          const messages = await fetchMessages(event.properties.sessionID)
          const usages = messages.flatMap((message) => {
            const usage = toCompletedUsageFromMessage(message)
            return usage === null ? [] : [usage]
          })
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
          return
        }
        default:
          return
      }
    },
    async dispose() {
      closePromise ??= resource.close()
      await closePromise
    },
  }
}
