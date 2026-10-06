import type { SidebarCardInputs } from "@jcendal/digital-pet-core/application/models/sidebar-card-inputs.ts"
import type { EvolutionBattleRepository } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"

import type { TuiCompositionApi } from "../tui.tsx"
import { buildPartnerInputs } from "./build-partner-inputs.ts"
import { DEV_EVOLUTION } from "./fixtures.ts"
import { registerDevCommandLayer } from "./register-dev-command-layer.tsx"
import { setupBattlePending, type DevScenarioRepository } from "./setup-scenario.ts"

export type DevToolsRuntime = {
  readonly runFeed: () => void
  readonly runActivity: () => void
  readonly runEvolutionReveal: () => Promise<void>
  readonly runEvolutionBattle: () => Promise<void>
}

export type AttachDevToolsDependencies = {
  readonly api: { readonly keymap: NonNullable<TuiCompositionApi["keymap"]> }
  readonly isDisposed: () => boolean
  readonly isBusy: () => boolean
  readonly feed: () => void
  readonly activity: () => void
  readonly tryResolveEvolutionBattle: () => Promise<boolean>
  readonly tryPlayEvolutionReveal: (nextInputs: SidebarCardInputs) => Promise<boolean>
  readonly setLastPresentedNodeId: (nodeId: string) => void
  readonly battleRepository?: EvolutionBattleRepository
}

export const attachDevTools = (deps: AttachDevToolsDependencies): (() => void) => {
  if (deps.api.keymap === undefined) return () => undefined

  const runtime: DevToolsRuntime = {
    runFeed: () => {
      if (deps.isDisposed() || deps.isBusy()) return
      deps.feed()
    },
    runActivity: () => {
      if (deps.isDisposed() || deps.isBusy()) return
      deps.activity()
    },
    runEvolutionReveal: async () => {
      if (deps.isDisposed() || deps.isBusy()) return
      deps.setLastPresentedNodeId(DEV_EVOLUTION.fromNodeId)
      const played = await deps.tryPlayEvolutionReveal(buildPartnerInputs(DIGIMON_CATALOG, DEV_EVOLUTION.toNodeId))
      if (!played) throw new Error("Evolution reveal did not play. Ensure the sidebar is visible.")
    },
    runEvolutionBattle: async () => {
      if (deps.isDisposed() || deps.isBusy()) return
      if (deps.battleRepository === undefined) throw new Error("Battle repository is unavailable.")
      setupBattlePending(deps.battleRepository as DevScenarioRepository)
      const battled = await deps.tryResolveEvolutionBattle()
      if (!battled) throw new Error("Evolution battle did not start. Ensure a partner is active.")
    },
  }

  const disposeLayer = registerDevCommandLayer({
    keymap: deps.api.keymap,
    runtime,
    isDisposed: deps.isDisposed,
  })

  return disposeLayer
}
