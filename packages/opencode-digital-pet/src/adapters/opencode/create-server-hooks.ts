import type { Hooks } from "@opencode-ai/plugin"

import { runDigitalPetFreezeCommand } from "../../commands/digital-pet-freeze.ts"
import { runDigitalPetSpawnCommand } from "../../commands/digital-pet-spawn.ts"
import { runDigitalPetSetCommand } from "../../commands/digital-pet-set.ts"
import { runDigitalPetUnfreezeCommand } from "../../commands/digital-pet-unfreeze.ts"
import type { DigitalPetCommandEvent } from "../../commands/digital-pet-command-result.ts"
import { loadDigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { DigitalPetLanguage } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { PartnerLifecycle } from "@jcendal/digital-pet-core/application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "@jcendal/digital-pet-core/application/ports/usage-ledger.ts"
import type { DigitalPetControl } from "@jcendal/digital-pet-core/application/ports/digital-pet-control.ts"
import type { UsageProcessingResult } from "@jcendal/digital-pet-core/application/models/usage.ts"
import { reconcileUsage } from "@jcendal/digital-pet-core/application/use-cases/reconcile-usage.ts"
import { recordUsage } from "@jcendal/digital-pet-core/application/use-cases/record-usage.ts"
import {
  STAGE_GAUGE_THRESHOLDS,
  type EvolutionSelector,
  type StageThresholds,
} from "@jcendal/digital-pet-core/domain/evolution.ts"
import type { SessionMessagesFetcher } from "./session-messages.ts"
import { toCompletedUsageFromEvent, toCompletedUsageFromMessage } from "./usage-event-mapper.ts"
import { formatDigitalPetToast, type DigitalPetToastEvent, type DigitalPetToastNotifier } from "./digital-pet-toast.ts"

export type ServerResource = {
  close(): Promise<void>
}

export type ServerHookDependencies = {
  readonly repository: PartnerLifecycle & UsageLedger & DigitalPetControl
  readonly resource: ServerResource
  readonly evolutionSelector?: EvolutionSelector
  readonly evolutionThresholds?: StageThresholds
  readonly fetchMessages?: SessionMessagesFetcher
  readonly language?: DigitalPetLanguage
  readonly notificationsEnabled?: boolean
  readonly loadCatalog?: () => Promise<DigimonCatalog>
  readonly notify?: DigitalPetToastNotifier
}

const noOpNotifier: DigitalPetToastNotifier = async () => {}
const EMPTY_CATALOG: DigimonCatalog = Object.freeze({ nodes: Object.freeze([]), byId: new Map() })

const toToastEvent = (result: UsageProcessingResult): DigitalPetToastEvent | undefined => {
  switch (result.kind) {
    case "applied":
      if (result.evolutionBattlePending !== undefined) {
        return { kind: "evolution_battle", opponentNodeId: result.evolutionBattlePending.opponentNodeId }
      }
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

const toCommandToastEvent = (event: DigitalPetCommandEvent): DigitalPetToastEvent => {
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

const requiresCatalog = (event: DigitalPetToastEvent): boolean => {
  switch (event.kind) {
    case "spawn":
    case "set":
    case "evolution":
    case "evolution_battle":
      return true
    case "freeze":
    case "unfreeze":
    case "defeat":
      return false
  }
}

export const createCommandConfig = () => ({
  "digital-pet-spawn": { template: "Spawn a new virtual pet." },
  "digital-pet-freeze": { template: "Freeze virtual pet progression." },
  "digital-pet-unfreeze": { template: "Unfreeze virtual pet progression." },
  "digital-pet-set": { template: "Set the virtual pet to a Digimon ID: $ARGUMENTS" },
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

  const notifyUsageResult = async (result: UsageProcessingResult, catalog: DigimonCatalog): Promise<void> => {
    if (result.kind !== "applied") return

    if (result.evolutionBattlePending !== undefined) {
      const battleToast = toToastEvent(result)
      if (battleToast !== undefined) await notifyEvent(battleToast, catalog)
      return
    }

    const toastEvent = toToastEvent(result)
    if (toastEvent !== undefined) await notifyEvent(toastEvent, catalog)
  }

  const notifyEvent = async (event: DigitalPetToastEvent, catalog?: DigimonCatalog): Promise<void> => {
    if (!notificationsEnabled) return
    await Promise.resolve()
      .then(async () => {
        const resolvedCatalog = catalog ?? (requiresCatalog(event) ? await loadCatalog() : EMPTY_CATALOG)
        const payload = formatDigitalPetToast(event, language, resolvedCatalog)
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
      const messageID = `digital-pet-${input.command}-${input.sessionID}-${crypto.randomUUID()}`
      switch (input.command) {
        case "digital-pet-spawn":
          {
            const result = await runDigitalPetSpawnCommand(repository, {
              sessionID: input.sessionID,
              messageID,
              createdAt: new Date().toISOString(),
            })
            output.parts.push(...result.parts)
            if (result.event !== undefined) await notifyEvent(toCommandToastEvent(result.event))
          }
          return
        case "digital-pet-freeze":
          {
            const result = await runDigitalPetFreezeCommand(repository, { sessionID: input.sessionID, messageID })
            output.parts.push(...result.parts)
            if (result.event !== undefined) await notifyEvent(toCommandToastEvent(result.event))
          }
          return
        case "digital-pet-unfreeze":
          {
            const result = await runDigitalPetUnfreezeCommand(repository, { sessionID: input.sessionID, messageID })
            output.parts.push(...result.parts)
            if (result.event !== undefined) await notifyEvent(toCommandToastEvent(result.event))
          }
          return
        case "digital-pet-set":
          {
            let catalog: DigimonCatalog | undefined
            const loadCommandCatalog = async (): Promise<DigimonCatalog> => (catalog ??= await loadCatalog())
            const result = await runDigitalPetSetCommand(
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
            catalogNodes: catalog.nodes,
            selector: evolutionSelector,
            thresholds: evolutionThresholds,
          })
          await notifyUsageResult(result, catalog)
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
            catalogNodes: catalog.nodes,
            selector: evolutionSelector,
            thresholds: evolutionThresholds,
          })
          for (const result of results) {
            await notifyUsageResult(result, catalog)
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
