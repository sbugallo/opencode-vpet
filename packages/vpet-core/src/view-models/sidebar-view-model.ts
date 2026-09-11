import type { SidebarCardInputs } from "../application/models/sidebar-card-inputs.ts"
import { DEFAULT_VPET_SETTINGS } from "../config/defaults.ts"
import type { ResolvedVpetSettings } from "../config/types.ts"
import { getStageKey, getStageLabel } from "../data/stages.ts"

export type SidebarCardModel =
  | { readonly kind: "no_partner"; readonly messageLine: string }
  | {
      readonly kind: "partner"
      readonly name: string
      readonly sprite: string
      readonly stage: string
      readonly stageNumber: number
      readonly url: string
      readonly gauge: number
      readonly threshold: number
      readonly isTerminal: boolean
      readonly frozen: boolean
      readonly isSetOverride: boolean
    }

export const buildSidebarCardModel = (
  inputs: SidebarCardInputs,
  settings: ResolvedVpetSettings = DEFAULT_VPET_SETTINGS,
): SidebarCardModel => {
  if (inputs.kind === "no_partner") return { kind: "no_partner", messageLine: "No active partner" }

  const stageKey = getStageKey(inputs.node.stage)
  return {
    kind: "partner",
    name: settings.language === "en" ? inputs.node.nameEn : inputs.node.nameJp,
    sprite: inputs.node.sprite,
    stage: getStageLabel(inputs.node.stage, settings.stageLabels[settings.language]),
    stageNumber: inputs.node.stage,
    url: inputs.node.url,
    gauge: inputs.gauge,
    threshold: settings.stageThresholds[stageKey],
    isTerminal: inputs.isTerminal,
    frozen: inputs.frozen,
    isSetOverride: inputs.isSetOverride,
  }
}
