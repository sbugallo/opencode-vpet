import { describe, expect, test } from "bun:test"

import { loadDigimonCatalog, parseDigimonCatalog, type DigimonNode } from "../src/data/catalog.ts"
import { DIGIMON_DATA } from "../src/data/digimon-data.ts"
import type { DigimonNode as DomainDigimonNode } from "../src/domain/digimon-node.ts"
import { applyTokenProgress, STAGE_GAUGE_THRESHOLDS, type StageThresholds } from "../src/domain/evolution.ts"
import type { Partner, PartnerProgression } from "../src/domain/partner.ts"
import { DIGIMON_STAGES, isDigimonStage } from "../src/domain/stage.ts"

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

describe("catalog and evolution", () => {
  test("Given domain contracts When catalog data is parsed Then normalized nodes use the domain stage and node shapes", () => {
    const node: DomainDigimonNode = controlledCurrent
    const partner: Partner = {
      partnerId: "partner-1",
      generation: 1,
      currentNodeId: node.id,
      gauge: 0,
      isTerminal: false,
      createdAt: "2026-07-31T00:00:00.000Z",
      retiredAt: null,
    }
    const progression: PartnerProgression = {
      currentNodeId: node.id,
      gauge: 0,
      isTerminal: false,
    }
    const thresholds: StageThresholds = STAGE_GAUGE_THRESHOLDS

    expect(DIGIMON_STAGES.every(isDigimonStage)).toBeTrue()
    expect(partner.currentNodeId).toBe(progression.currentNodeId)
    expect(thresholds[node.stage]).toBe(500_000)
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

  test("Given a threshold crossing on a same-stage edge When token progress applies Then it resets after exactly one selected evolution", async () => {
    const catalog = await loadDigimonCatalog()
    const andromon = catalog.byId.get("5-003")

    if (andromon === undefined) throw new Error("Expected Andromon in catalog")

    const evolved = applyTokenProgress(
      { current: andromon, gauge: 12_499_999, isTerminal: false },
      1,
      () => 0.5,
      catalog.byId,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(evolved.current.id).toBe("5-033")
    expect(evolved.gauge).toBe(0)
  })

  test("Given a controlled immutable lookup When token progress reaches a threshold Then it selects the lookup target and marks terminal state", () => {
    const lookup = new Map([[controlledTarget.id, controlledTarget]])

    const evolved = applyTokenProgress(
      { current: controlledCurrent, gauge: 499_999, isTerminal: false },
      1,
      () => 0,
      lookup,
      STAGE_GAUGE_THRESHOLDS,
    )

    expect(evolved).toEqual({ current: controlledTarget, gauge: 0, isTerminal: true })
  })

  test("Given a controlled lookup missing the selected target When token progress reaches a threshold Then it retains the existing catalog error", () => {
    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 499_999, isTerminal: false },
        1,
        () => 0,
        new Map(),
        STAGE_GAUGE_THRESHOLDS,
      ),
    ).toThrow("Evolution target controlled-target is missing from the catalog")
  })

  test("Given a custom child threshold When token progress reaches it Then evolution crosses at the supplied policy boundary", () => {
    const thresholds: StageThresholds = Object.freeze({
      ...STAGE_GAUGE_THRESHOLDS,
      0: 1,
    })

    const evolved = applyTokenProgress(
      { current: controlledCurrent, gauge: 0, isTerminal: false },
      1,
      () => 0,
      new Map([[controlledTarget.id, controlledTarget]]),
      thresholds,
    )

    expect(evolved).toEqual({ current: controlledTarget, gauge: 0, isTerminal: true })
  })

  test("Given an invalid selector When token progress reaches a threshold Then the existing selector error is retained", () => {
    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 499_999, isTerminal: false },
        1,
        () => 1,
        new Map([[controlledTarget.id, controlledTarget]]),
        STAGE_GAUGE_THRESHOLDS,
      ),
    ).toThrow("Evolution selector must return a finite number in [0, 1), received 1")
  })

  test("Given a terminal partner When token progress applies Then it preserves the existing terminal state", () => {
    const state = { current: controlledTarget, gauge: 0, isTerminal: true } as const

    expect(
      applyTokenProgress(
        state,
        1,
        () => {
          throw new Error("selector must not run")
        },
        new Map(),
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
        { current: controlledCurrent, gauge: 0, isTerminal: false },
        1,
        () => {
          throw new Error("selector must not run")
        },
        new Map(),
        thresholds,
      ),
    ).toEqual({ current: controlledCurrent, gauge: 1, isTerminal: false })
  })

  test("Given an incomplete untyped threshold policy When token progress applies Then it rejects the policy before evolution", () => {
    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 0, isTerminal: false },
        1,
        () => 0,
        new Map([[controlledTarget.id, controlledTarget]]),
        {},
      ),
    ).toThrow("Evolution thresholds must be a complete frozen policy of positive finite numbers")
  })

  test("Given a mutable threshold policy When token progress applies Then it rejects the policy before it can affect evolution", () => {
    const thresholds = { ...STAGE_GAUGE_THRESHOLDS, 0: 1 }
    thresholds[0] = 2

    expect(() =>
      applyTokenProgress(
        { current: controlledCurrent, gauge: 0, isTerminal: false },
        1,
        () => 0,
        new Map([[controlledTarget.id, controlledTarget]]),
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
          { current: controlledCurrent, gauge: 0, isTerminal: false },
          1,
          () => 0,
          new Map([[controlledTarget.id, controlledTarget]]),
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
        { current: controlledCurrent, gauge: 0, isTerminal: false },
        1,
        () => {
          throw new Error("selector must not run")
        },
        new Map(),
        thresholds,
      ),
    ).toEqual({ current: controlledCurrent, gauge: 1, isTerminal: false })
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
