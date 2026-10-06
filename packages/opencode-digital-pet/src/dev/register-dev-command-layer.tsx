/** @jsxImportSource @opentui/solid */
import type { TuiKeymap } from "@opencode-ai/plugin/tui"

import { OPENCODE_DEV_ACTIONS, type OpencodeDevActionId } from "./catalog.ts"
import type { DevToolsRuntime } from "./attach-dev-tools.ts"

export type DevCommandLayerDependencies = {
  readonly keymap: Pick<TuiKeymap, "registerLayer">
  readonly runtime: DevToolsRuntime
  readonly isDisposed: () => boolean
}

export const registerDevCommandLayer = ({
  keymap,
  runtime,
  isDisposed,
}: DevCommandLayerDependencies): ReturnType<TuiKeymap["registerLayer"]> => {
  const handlers: Record<OpencodeDevActionId, () => void | Promise<void>> = {
    feed: () => runtime.runFeed(),
    activity: () => runtime.runActivity(),
    evolution_reveal: () => runtime.runEvolutionReveal(),
    evolution_battle: () => runtime.runEvolutionBattle(),
    defeat: () => runtime.runEvolutionBattle(),
  }

  return keymap.registerLayer({
    name: "opencode-digital-pet-dev.layer",
    namespace: "opencode-digital-pet-dev",
    commands: OPENCODE_DEV_ACTIONS.map((action) => ({
      name: action.id,
      title: action.title,
      description: action.title,
      category: "Digital Pet Dev",
      namespace: "palette",
      slashName: action.slashName,
      run: () => {
        if (isDisposed()) return
        void handlers[action.id]()
      },
    })),
  })
}
