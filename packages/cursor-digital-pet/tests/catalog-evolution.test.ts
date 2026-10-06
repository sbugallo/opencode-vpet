import { describe, expect, test } from "bun:test"

import type { DigimonNode } from "@jcendal/digital-pet-core/data/catalog.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import {
  applyTokenProgress,
  resolveEvolutionBattle,
  STAGE_GAUGE_THRESHOLDS,
  type StageThresholds,
} from "@jcendal/digital-pet-core/domain/evolution.ts"

const noBattle = {
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
} as const

const controlledCurrent: DigimonNode = {
  id: "controlled-current",
  nameEn: "Controlled Current",
  nameJp: "Controlled Current",
  nextEvolutions: ["controlled-target"],
  sprite: "controlled-current.png",
  stage: 0,
  url: "https://example.test/controlled-current",
}

const controlledTarget: DigimonNode = {
  id: "controlled-target",
  nameEn: "Controlled Target",
  nameJp: "Controlled Target",
  nextEvolutions: [],
  sprite: "controlled-target.png",
  stage: 1,
  url: "https://example.test/controlled-target",
}

const controlledCatalogNodes = [controlledCurrent, controlledTarget]
const controlledLookup = new Map(controlledCatalogNodes.map((node) => [node.id, node]))

describe("catalog and evolution", () => {
  test("Given a Digitama threshold crossing When token progress applies Then it evolves immediately without a battle", () => {
    const evolved = applyTokenProgress(
      { current: controlledCurrent, gauge: 4_999_999, isTerminal: false, ...noBattle },
      1,
      () => 0,
      controlledLookup,
      controlledCatalogNodes,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(evolved).toEqual({
      current: controlledTarget,
      gauge: 0,
      isTerminal: true,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })
  })

  test("Given progress below threshold When token progress applies Then it only accumulates gauge", () => {
    const thresholds: StageThresholds = Object.freeze({
      ...STAGE_GAUGE_THRESHOLDS,
      0: 2,
    })

    expect(
      applyTokenProgress(
        { current: controlledCurrent, gauge: 0, isTerminal: false, ...noBattle },
        1,
        () => {
          throw new Error("selector must not run")
        },
        controlledLookup,
        controlledCatalogNodes,
        thresholds,
      ),
    ).toEqual({ current: controlledCurrent, gauge: 1, isTerminal: false, ...noBattle })
  })

  test("Given a lost evolution battle When resolving Then gauge resets for the current stage", () => {
    const andromon = DIGIMON_CATALOG.byId.get("5-003")
    if (andromon === undefined) throw new Error("Expected Andromon in catalog")

    const pending = applyTokenProgress(
      { current: andromon, gauge: 124_999_999, isTerminal: false, ...noBattle },
      1,
      () => 0.5,
      DIGIMON_CATALOG.byId,
      DIGIMON_CATALOG.nodes,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(pending.pendingEvolutionTargetId).not.toBeNull()
    expect(resolveEvolutionBattle(pending, false, DIGIMON_CATALOG.byId)).toEqual({
      current: andromon,
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })
  })
})
