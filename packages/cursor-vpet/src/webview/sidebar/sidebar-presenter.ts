import type { SidebarSnapshot } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import { getSidebarCardInputs } from "@sbugallo/vpet-core/application/use-cases/get-sidebar-card-inputs.ts"
import { DEFAULT_VPET_SETTINGS } from "@sbugallo/vpet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { buildSidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"

import type { MonsterAnimationIdentity } from "@sbugallo/vpet-animation/idle/monster-animation.ts"
import { toSidebarWebviewPayload, type SidebarWebviewPayload } from "./sidebar-render.ts"

export type SidebarPresentation = {
  readonly payload: SidebarWebviewPayload
  readonly partner: MonsterAnimationIdentity | undefined
}

export const buildSidebarPresentation = (snapshot: SidebarSnapshot | null): SidebarPresentation => {
  const reader = { getSidebarSnapshot: () => snapshot }
  const inputs = getSidebarCardInputs(reader, DIGIMON_CATALOG)
  const model = buildSidebarCardModel(inputs, DEFAULT_VPET_SETTINGS)
  const payload = toSidebarWebviewPayload(model)
  const partner = model.kind === "partner" ? { sprite: model.sprite, isDigitama: model.stageNumber === 0 } : undefined
  return { payload, partner }
}
