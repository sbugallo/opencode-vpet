import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { freezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/freeze-digital-pet.ts"
import { resolveEvolutionBattleForPartner } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { setDigitalPetCheatNode } from "@jcendal/digital-pet-core/application/use-cases/set-digital-pet-cheat-node.ts"
import { spawnPartner } from "@jcendal/digital-pet-core/application/use-cases/spawn-partner.ts"
import { unfreezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/unfreeze-digital-pet.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"

import { createSqliteSidebarSnapshotReader } from "../../src/adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { applyTokenUsage, createTempTestRoot, removeTempTestRoot, type TempTestRoot } from "./persistence-fixtures.ts"

let tempRoot: TempTestRoot | undefined

beforeEach(async () => {
  tempRoot = await createTempTestRoot()
})

afterEach(async () => {
  if (tempRoot === undefined) return
  await removeTempTestRoot(tempRoot)
  tempRoot = undefined
})

describe("cursor-digital-pet game persistence", () => {
  test("Given repeated spawns When reading the active partner Then generation increments", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      spawnPartner(repository, "2026-09-09T12:01:00.000Z")
      expect(repository.getActivePartner()?.generation).toBe(2)
    } finally {
      repository.close()
    }
  })

  test("Given a Digitama and a low hatch threshold When usage is recorded Then the partner evolves immediately", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const hatchThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1 })
    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    const reader = await createSqliteSidebarSnapshotReader({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      const outcome = applyTokenUsage(repository, "receipt-hatch", 1, { thresholds: hatchThresholds })
      expect(outcome.kind).toBe("applied")
      if (outcome.kind !== "applied") throw new Error("expected applied usage outcome")
      expect(outcome.evolution).toBeDefined()
      expect(reader.getSidebarSnapshot()?.currentNodeId).not.toBe("0-001")
      expect(reader.getSidebarSnapshot()?.pendingEvolutionTargetId).toBeNull()
    } finally {
      repository.close()
    }
  })

  test("Given a threshold crossing on a higher stage When usage is recorded Then a pending evolution battle opens", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const battleThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1, 1: 1 })
    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      applyTokenUsage(repository, "receipt-hatch", 1, { thresholds: battleThresholds })
      applyTokenUsage(repository, "receipt-threshold", 1, { thresholds: battleThresholds })

      const pending = repository.getSidebarSnapshot()
      expect(pending?.pendingEvolutionTargetId).not.toBeNull()
      expect(pending?.battleOpponentNodeId).not.toBeNull()
    } finally {
      repository.close()
    }
  })

  test("Given a lost evolution battle When it is resolved Then gauge resets for the current stage", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const battleThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 1, 1: 1 })
    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      applyTokenUsage(repository, "receipt-hatch", 1, { thresholds: battleThresholds })
      applyTokenUsage(repository, "receipt-threshold", 1, { thresholds: battleThresholds })
      const gaugeBeforeLoss = repository.getSidebarSnapshot()?.gauge

      resolveEvolutionBattleForPartner(repository, false, DIGIMON_CATALOG.byId, "2026-09-09T12:02:00.000Z")

      const resolved = repository.getSidebarSnapshot()
      expect(resolved?.pendingEvolutionTargetId).toBeNull()
      expect(resolved?.battleOpponentNodeId).toBeNull()
      expect(gaugeBeforeLoss).toBeGreaterThan(0)
      expect(resolved?.gauge).toBe(0)
    } finally {
      repository.close()
    }
  })

  test("Given a duplicate usage receipt When it is recorded twice Then only the first application changes state", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      const first = applyTokenUsage(repository, "receipt-dup", 5)
      const second = applyTokenUsage(repository, "receipt-dup", 5)

      expect(first.kind).toBe("applied")
      expect(second.kind).toBe("duplicate")
      expect(repository.getSidebarSnapshot()?.gauge).toBe(5)
    } finally {
      repository.close()
    }
  })

  test("Given a frozen partner When usage is recorded Then trainer tokens increase without evolving the partner", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    const reader = await createSqliteSidebarSnapshotReader({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      applyTokenUsage(repository, "receipt-before-freeze", 3)
      const gaugeBeforeFreeze = reader.getSidebarSnapshot()?.gauge
      freezeDigitalPet(repository)
      applyTokenUsage(repository, "receipt-while-frozen", 4)

      const snapshot = reader.getSidebarSnapshot()
      expect(snapshot?.frozen).toBe(true)
      expect(snapshot?.gauge).toBe(gaugeBeforeFreeze)
      expect(snapshot?.trainerTotalTokens).toBe(7)
    } finally {
      repository.close()
    }
  })

  test("Given a frozen partner When it is unfrozen Then later usage progresses the gauge again", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    const reader = await createSqliteSidebarSnapshotReader({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      freezeDigitalPet(repository)
      applyTokenUsage(repository, "receipt-frozen", 2)
      unfreezeDigitalPet(repository)
      applyTokenUsage(repository, "receipt-after-unfreeze", 3)

      const snapshot = reader.getSidebarSnapshot()
      expect(snapshot?.frozen).toBe(false)
      expect(snapshot?.gauge).toBe(3)
    } finally {
      repository.close()
    }
  })

  test("Given a cheat node override When the sidebar snapshot is read Then it projects the set partner", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteDigitalPetRepository({ appDataRoot: tempRoot.appDataRoot })
    const reader = await createSqliteSidebarSnapshotReader({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      setDigitalPetCheatNode(repository, "3-001")

      const snapshot = reader.getSidebarSnapshot()
      expect(snapshot?.currentNodeId).toBe("3-001")
      expect(snapshot?.isSetOverride).toBe(true)
    } finally {
      repository.close()
    }
  })
})
