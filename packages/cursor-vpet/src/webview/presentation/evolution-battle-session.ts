import type { ResolveEvolutionBattleOutcome } from "@sbugallo/vpet-core/application/models/usage.ts"
import type { SidebarSnapshot } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import {
  resolveEvolutionBattleForPartner,
  type EvolutionBattleRepository,
} from "@sbugallo/vpet-core/application/use-cases/resolve-evolution-battle.ts"
import type { DigimonCatalog } from "@sbugallo/vpet-core/data/catalog.ts"
import type { MonsterFrameCatalog } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

import { runDefeatAnimation } from "./defeat-artwork.ts"
import { runEvolutionBattleAnimation, type EvolutionBattleOutcome } from "./evolution-battle-artwork.ts"
import { runEvolutionRevealSession } from "./evolution-reveal-session.ts"

export type EvolutionBattleSessionDependencies = {
  readonly frameCatalog: MonsterFrameCatalog
  readonly digimonCatalog: DigimonCatalog
  readonly repository: EvolutionBattleRepository
  readonly random?: () => number
  readonly onArtwork: (artwork: string) => Promise<void>
  readonly onResolved?: (result: ResolveEvolutionBattleOutcome) => Promise<void>
}

export const runEvolutionBattleSession = async (
  snapshot: SidebarSnapshot,
  viewportWidth: number,
  dependencies: EvolutionBattleSessionDependencies,
): Promise<boolean> => {
  if (snapshot.pendingEvolutionTargetId === null || snapshot.battleOpponentNodeId === null) return false

  const player = dependencies.digimonCatalog.byId.get(snapshot.currentNodeId)
  const opponent = dependencies.digimonCatalog.byId.get(snapshot.battleOpponentNodeId)
  if (player === undefined || opponent === undefined) return false

  const random = dependencies.random ?? Math.random
  const outcome: EvolutionBattleOutcome = random() < 0.5 ? "player" : "opponent"
  const postArtwork = async (artwork: string): Promise<void> => dependencies.onArtwork(artwork)

  await runEvolutionBattleAnimation(
    dependencies.frameCatalog,
    player.sprite,
    opponent.sprite,
    viewportWidth,
    outcome,
    postArtwork,
    random,
  )

  if (outcome === "player") {
    await runEvolutionRevealSession(
      { fromNodeId: snapshot.currentNodeId, toNodeId: snapshot.pendingEvolutionTargetId },
      viewportWidth,
      {
        frameCatalog: dependencies.frameCatalog,
        digimonCatalog: dependencies.digimonCatalog,
        onArtwork: postArtwork,
      },
    )
  } else {
    await runDefeatAnimation(dependencies.frameCatalog, player.sprite, viewportWidth, postArtwork)
  }

  const result = resolveEvolutionBattleForPartner(
    dependencies.repository,
    outcome === "player",
    dependencies.digimonCatalog.byId,
    new Date().toISOString(),
  )
  await dependencies.onResolved?.(result)
  return true
}
