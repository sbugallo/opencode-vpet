import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { getSidebarCardInputs } from "@jcendal/digital-pet-core/application/use-cases/get-sidebar-card-inputs.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { buildSidebarCardModel } from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"

import type { MonsterAnimationIdentity } from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { toSidebarWebviewPayload, type SidebarWebviewPayload } from "./sidebar-render.ts"

export type SidebarPresentation = {
  readonly payload: SidebarWebviewPayload
  readonly partner: MonsterAnimationIdentity | undefined
}

export const buildSidebarPresentation = (snapshot: SidebarSnapshot | null): SidebarPresentation => {
  const reader = { getSidebarSnapshot: () => snapshot }
  const inputs = getSidebarCardInputs(reader, DIGIMON_CATALOG)
  const model = buildSidebarCardModel(inputs, DEFAULT_DIGITAL_PET_SETTINGS)
  const payload = toSidebarWebviewPayload(model)
  const partner = model.kind === "partner" ? { sprite: model.sprite, isDigitama: model.stageNumber === 0 } : undefined
  return { payload, partner }
}
