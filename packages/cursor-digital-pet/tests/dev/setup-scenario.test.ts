import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"

import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { recordUsage } from "@jcendal/digital-pet-core/application/use-cases/record-usage.ts"
import { resolveEvolutionBattleForPartner } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { spawnPartner } from "@jcendal/digital-pet-core/application/use-cases/spawn-partner.ts"
import type { StageThresholds } from "@jcendal/digital-pet-core/domain/evolution.ts"
import { DIGIMON_STAGES } from "@jcendal/digital-pet-core/domain/stage.ts"

import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { setupBattlePending } from "../../src/dev/setup-scenario.ts"

const DEV_INSTANT_BATTLE_THRESHOLDS: StageThresholds = Object.freeze(
  Object.fromEntries(DIGIMON_STAGES.map((stage) => [stage, 1])) as StageThresholds,
)

const applyDevUsage = (
  repository: Awaited<ReturnType<typeof createSqliteDigitalPetRepository>>,
  receiptKey: string,
): void => {
  recordUsage({
    usage: {
      receiptKey,
      eventId: `dev:${receiptKey}`,
      tokenDelta: 1,
      cost: null,
      createdAt: new Date().toISOString(),
    },
    ledger: repository,
    digimonById: DIGIMON_CATALOG.byId,
    catalogNodes: DIGIMON_CATALOG.nodes,
    selector: () => 0,
    thresholds: DEV_INSTANT_BATTLE_THRESHOLDS,
  })
}

const advancePartnerToStage = (
  repository: Awaited<ReturnType<typeof createSqliteDigitalPetRepository>>,
  targetStage: number,
): void => {
  for (let step = 0; step < 12; step += 1) {
    const partner = repository.getActivePartner()
    const current = partner === null ? undefined : DIGIMON_CATALOG.byId.get(partner.currentNodeId)
    if (current !== undefined && current.stage >= targetStage) return

    applyDevUsage(repository, `dev-progress-${step}`)
    const pending = repository.getActivePartner()
    if (pending?.pendingEvolutionTargetId !== null && pending?.battleOpponentNodeId !== null) {
      resolveEvolutionBattleForPartner(repository, true, DIGIMON_CATALOG.byId, `dev-battle-${step}-${Date.now()}`)
    }
  }
}

describe("cursor-digital-pet dev setup-scenario", () => {
  test("Given a perfect-stage partner When battle setup runs Then a pending evolution battle opens", async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-cursor-digital-pet-dev-perfect-"))
    try {
      const repository = await createSqliteDigitalPetRepository({ appDataRoot: root })
      try {
        spawnPartner(repository, new Date().toISOString())
        advancePartnerToStage(repository, 4)

        const current = DIGIMON_CATALOG.byId.get(repository.getActivePartner()?.currentNodeId ?? "")
        expect(current?.stage).toBeGreaterThanOrEqual(4)

        setupBattlePending(repository)
        const snapshot = repository.getSidebarSnapshot()
        expect(snapshot?.pendingEvolutionTargetId).not.toBeNull()
        expect(snapshot?.battleOpponentNodeId).not.toBeNull()
      } finally {
        repository.close()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given an empty database When battle setup runs Then a pending evolution battle opens", async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-cursor-digital-pet-dev-"))
    try {
      const repository = await createSqliteDigitalPetRepository({ appDataRoot: root })
      try {
        setupBattlePending(repository)
        const snapshot = repository.getSidebarSnapshot()
        expect(snapshot?.pendingEvolutionTargetId).not.toBeNull()
        expect(snapshot?.battleOpponentNodeId).not.toBeNull()
      } finally {
        repository.close()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
