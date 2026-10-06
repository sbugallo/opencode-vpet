import type { UsageEvolutionTransition } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"

import { runEvolutionAnimation } from "../sequences/evolution-artwork.ts"

export type EvolutionRevealSessionDependencies = {
  readonly frameCatalog: MonsterFrameCatalog
  readonly digimonCatalog: DigimonCatalog
  readonly onArtwork: (artwork: string) => Promise<void>
}

export const runEvolutionRevealSession = async (
  evolution: UsageEvolutionTransition,
  viewportWidth: number,
  dependencies: EvolutionRevealSessionDependencies,
): Promise<boolean> => {
  const from = dependencies.digimonCatalog.byId.get(evolution.fromNodeId)
  const to = dependencies.digimonCatalog.byId.get(evolution.toNodeId)
  if (from === undefined || to === undefined) return false

  await runEvolutionAnimation(dependencies.frameCatalog, from.sprite, to.sprite, viewportWidth, async (artwork) =>
    dependencies.onArtwork(artwork),
  )
  return true
}
