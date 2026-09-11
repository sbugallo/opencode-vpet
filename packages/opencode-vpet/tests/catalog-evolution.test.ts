import { describe, expect, test } from "bun:test"

import { loadDigimonCatalog, parseDigimonCatalog, type DigimonNode } from "@sbugallo/vpet-core/data/catalog.ts"
import { DIGIMON_DATA } from "@sbugallo/vpet-core/data/digimon-data.ts"
import type { DigimonNode as DomainDigimonNode } from "@sbugallo/vpet-core/domain/digimon-node.ts"
import {
  applyTokenProgress,
  resolveEvolutionBattle,
  STAGE_GAUGE_THRESHOLDS,
  type StageThresholds,
} from "@sbugallo/vpet-core/domain/evolution.ts"
import type { Partner, PartnerProgression } from "@sbugallo/vpet-core/domain/partner.ts"
import { DIGIMON_STAGES, isDigimonStage } from "@sbugallo/vpet-core/domain/stage.ts"

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

const controlledOpponent: DigimonNode = {
  id: "controlled-opponent",
  nameEn: "Controlled Opponent",
  nameJp: "Controlled Opponent",
  nextEvolutions: [],
  sprite: "controlled-opponent.png",
  stage: 0,
  url: "https://example.test/controlled-opponent",
}

const controlledCatalogNodes = [controlledCurrent, controlledTarget, controlledOpponent]
const controlledLookup = new Map(controlledCatalogNodes.map((node) => [node.id, node]))

describe("catalog and evolution", () => {
  test("Given domain contracts When catalog data is parsed Then normalized nodes use the domain stage and node shapes", () => {
    const node: DomainDigimonNode = controlledCurrent
    const partner: Partner = {
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: node.id,
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
      createdAt: "2026-07-31T00:00:00.000Z",
      retiredAt: null,
    }
    const progression: PartnerProgression = {
      currentNodeId: node.id,
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    }
    const thresholds: StageThresholds = STAGE_GAUGE_THRESHOLDS

    expect(DIGIMON_STAGES.every(isDigimonStage)).toBeTrue()
    expect(partner.currentNodeId).toBe(progression.currentNodeId)
    expect(thresholds[node.stage]).toBe(5_000_000)
  })

  test("Given a raw catalog row with a reference URL When parsing Then the normalized node preserves the URL and evolution references are immutable", () => {
    const rawCurrent = controlledCurrentToRaw()
    const catalog = parseDigimonCatalog([rawCurrent, controlledTargetToRaw()])
    const current = catalog.byId.get(controlledCurrent.id)

    if (current === undefined) throw new Error("Expected controlled current node")

    expect(Object.isFrozen(current)).toBeTrue()
    expect(Object.isFrozen(current.nextEvolutions)).toBeTrue()
    expect(Object.isFrozen(catalog.nodes)).toBeTrue()
    expect(Object.keys(current).sort()).toEqual(["id", "nameEn", "nameJp", "nextEvolutions", "sprite", "stage", "url"])
    expect(current.url).toBe(rawCurrent.url)
    expect(current).toMatchObject({ url: "https://example.test/controlled-current" })
  })

  test("Given the latest DIGIMON_DATA When the catalog loads Then canonical graph edges and URL metadata remain addressable", async () => {
    const catalog = await loadDigimonCatalog()

    expect(catalog.nodes).toHaveLength(650)
    expect(catalog.byId.get("5-003")?.nextEvolutions).toEqual([
      "6-068",
      "6-091",
      "6-080",
      "5-033",
      "6-143",
      "6-028",
      "6-125",
    ])
    expect(catalog.byId.get("7-011")).toMatchObject({
      id: "7-011",
      nameEn: "DarknessBagramon",
      nextEvolutions: [],
      url: "https://digimon.net/reference_en/detail.php?directory_name=darknessbagramon",
    })
    expect(catalog.byId.get("7-045")).toMatchObject({
      id: "7-045",
      nameEn: "Chaosdramon",
      url: "https://digimon.net/reference_en/detail.php?directory_name=chaosdramon",
    })
    expect(catalog.byId.get("2-033")?.sprite).toBe("")
    expect(catalog.byId.has("7-046")).toBeFalse()
    expect(catalog.nodes.some((node) => node.nextEvolutions.includes("7-046"))).toBeFalse()
  })

  test("Given the canonical raw catalog When normalized nodes load Then every URL remains equal in record order", async () => {
    const catalog = await loadDigimonCatalog()

    expect(catalog.nodes.map((node) => ({ id: node.id, url: node.url }))).toEqual(
      DIGIMON_DATA.map((record) => ({ id: record.id, url: record.url })),
    )
  })

  test("Given duplicate or dangling catalog rows When parsing Then validation rejects them", () => {
    const root = {
      id: "0-001",
      name_en: "Root",
      name_jp: "Root",
      next_evolutions: ["1-001"],
      sprite: "egg",
      stage: 0,
      url: "https://example.test/root",
    }

    expect(() => parseDigimonCatalog([root, root])).toThrow(/duplicate/i)
    expect(() => parseDigimonCatalog([root])).toThrow(/next_evolutions/i)
  })

  test("Given a threshold crossing on a same-stage edge When token progress applies Then it opens a pending evolution battle", async () => {
    const catalog = await loadDigimonCatalog()
    const andromon = catalog.byId.get("5-003")

    if (andromon === undefined) throw new Error("Expected Andromon in catalog")

    const pending = applyTokenProgress(
      { current: andromon, gauge: 124_999_999, isTerminal: false, ...noBattle },
      1,
      () => 0.5,
      catalog.byId,
      catalog.nodes,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(pending.current.id).toBe("5-003")
    expect(pending.pendingEvolutionTargetId).toBe("5-033")
    expect(pending.battleOpponentNodeId).not.toBe("5-003")
    expect(pending.gauge).toBe(STAGE_GAUGE_THRESHOLDS[5])

    const evolved = resolveEvolutionBattle(pending, true, catalog.byId)
    expect(evolved.current.id).toBe("5-033")
    expect(evolved.gauge).toBe(0)
    expect(evolved.pendingEvolutionTargetId).toBeNull()
  })

  test("Given a controlled immutable lookup When token progress reaches a threshold Then it opens a pending evolution battle", () => {
    const pending = applyTokenProgress(
      { current: controlledCurrent, gauge: 4_999_999, isTerminal: false, ...noBattle },
      1,
      () => 0,
      controlledLookup,
      controlledCatalogNodes,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(pending).toEqual({
      current: controlledCurrent,
      gauge: STAGE_GAUGE_THRESHOLDS[0],
      isTerminal: false,
      pendingEvolutionTargetId: "controlled-target",
      battleOpponentNodeId: "controlled-opponent",
    })

    expect(resolveEvolutionBattle(pending, true, controlledLookup)).toEqual({
      current: controlledTarget,
      gauge: 0,
      isTerminal: true,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })
  })

  test("Given a controlled lookup missing the selected target When token progress reaches a threshold Then it retains the existing catalog error", () => {
    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 4_999_999, isTerminal: false, ...noBattle },
        1,
        () => 0,
        new Map([[controlledCurrent.id, controlledCurrent]]),
        [controlledCurrent],
        STAGE_GAUGE_THRESHOLDS,
      ),
    ).toThrow("Evolution target controlled-target is missing from the catalog")
  })

  test("Given a custom child threshold When token progress reaches it Then evolution crosses at the supplied policy boundary", () => {
    const thresholds: StageThresholds = Object.freeze({
      ...STAGE_GAUGE_THRESHOLDS,
      0: 1,
    })

    const pending = applyTokenProgress(
      { current: controlledCurrent, gauge: 0, isTerminal: false, ...noBattle },
      1,
      () => 0,
      controlledLookup,
      controlledCatalogNodes,
      thresholds,
    )

    expect(resolveEvolutionBattle(pending, true, controlledLookup)).toEqual({
      current: controlledTarget,
      gauge: 0,
      isTerminal: true,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })
  })

  test("Given an invalid selector When token progress reaches a threshold Then the existing selector error is retained", () => {
    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 4_999_999, isTerminal: false, ...noBattle },
        1,
        () => 1,
        controlledLookup,
        controlledCatalogNodes,
        STAGE_GAUGE_THRESHOLDS,
      ),
    ).toThrow("Evolution selector must return a finite number in [0, 1), received 1")
  })

  test("Given a terminal partner When token progress applies Then it preserves the existing terminal state", () => {
    const state = { current: controlledTarget, gauge: 0, isTerminal: true, ...noBattle } as const

    expect(
      applyTokenProgress(
        state,
        1,
        () => {
          throw new Error("selector must not run")
        },
        controlledLookup,
        controlledCatalogNodes,
        STAGE_GAUGE_THRESHOLDS,
      ),
    ).toBe(state)
  })

  test("Given progress below a custom child threshold When token progress applies Then it only accumulates gauge", () => {
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

  test("Given an incomplete untyped threshold policy When token progress applies Then it rejects the policy before evolution", () => {
    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 0, isTerminal: false, ...noBattle },
        1,
        () => 0,
        controlledLookup,
        controlledCatalogNodes,
        {},
      ),
    ).toThrow("Evolution thresholds must be a complete frozen policy of positive finite numbers")
  })

  test("Given a mutable threshold policy When token progress applies Then it rejects the policy before it can affect evolution", () => {
    const thresholds = { ...STAGE_GAUGE_THRESHOLDS, 0: 1 }
    thresholds[0] = 2

    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 0, isTerminal: false, ...noBattle },
        1,
        () => 0,
        controlledLookup,
        controlledCatalogNodes,
        thresholds,
      ),
    ).toThrow("Evolution thresholds must be a complete frozen policy of positive finite numbers")
  })

  test("Given frozen policies with non-positive or non-finite thresholds When token progress applies Then it rejects each policy before evolution", () => {
    const policies = [
      Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 0 }),
      Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: Number.NaN }),
      Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: Number.POSITIVE_INFINITY }),
    ]

    for (const thresholds of policies) {
      expect(() =>
        applyTokenProgress(
          { current: controlledCurrent, gauge: 0, isTerminal: false, ...noBattle },
          1,
          () => 0,
          controlledLookup,
          controlledCatalogNodes,
          thresholds,
        ),
      ).toThrow("Evolution thresholds must be a complete frozen policy of positive finite numbers")
    }
  })

  test("Given a valid frozen threshold policy When mutation is attempted Then it remains safe for later evolution", () => {
    const thresholds: StageThresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 0: 2 })

    expect(Reflect.set(thresholds, 0, 1)).toBeFalse()
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
    const pending = applyTokenProgress(
      { current: controlledCurrent, gauge: 4_999_999, isTerminal: false, ...noBattle },
      1,
      () => 0,
      controlledLookup,
      controlledCatalogNodes,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(resolveEvolutionBattle(pending, false, controlledLookup)).toEqual({
      current: controlledCurrent,
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    })
  })
})

const controlledCurrentToRaw = () => ({
  id: controlledCurrent.id,
  name_en: controlledCurrent.nameEn,
  name_jp: controlledCurrent.nameJp,
  next_evolutions: controlledCurrent.nextEvolutions,
  sprite: controlledCurrent.sprite,
  stage: controlledCurrent.stage,
  url: controlledCurrent.url,
})

const controlledTargetToRaw = () => ({
  id: controlledTarget.id,
  name_en: controlledTarget.nameEn,
  name_jp: controlledTarget.nameJp,
  next_evolutions: controlledTarget.nextEvolutions,
  sprite: controlledTarget.sprite,
  stage: controlledTarget.stage,
  url: controlledTarget.url,
})
