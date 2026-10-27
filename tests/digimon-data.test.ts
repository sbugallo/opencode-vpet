import { describe, expect, test } from "bun:test"
import { DIGIMON_DATA, DIGIMON_ID_MIGRATION, DIGIMON_STAGES, DIGITAMA_FIELD_EGGS } from "../src/data/digimon-data"

const RAW_RECORD_KEYS = ["id", "name_en", "name_jp", "next_evolutions", "sprite", "stage", "url"]

describe("bundled Digimon data", () => {
  test("Given the bundled catalog, when it is loaded, then it preserves every record's schema and links", () => {
    const dataIds = new Set(DIGIMON_DATA.map((record) => record.id))

    expect(DIGIMON_DATA).toHaveLength(1168)
    expect(dataIds.size).toBe(DIGIMON_DATA.length)

    for (const record of DIGIMON_DATA) {
      expect(Object.keys(record).sort()).toEqual(RAW_RECORD_KEYS)
      expect(DIGIMON_STAGES).toContain(record.stage)
      expect(record.id).toMatch(/^(D|BI|BII|C|A|AR|H|P|U|SU|UN)-\d{3}$/)
      expect(record.sprite).not.toBe("")

      for (const evolutionId of record.next_evolutions) {
        expect(dataIds.has(evolutionId)).toBe(true)
      }
    }
  })

  test("Given the bundled catalog, when representative records are loaded, then their evolution data and URLs remain exact", () => {
    expect(DIGIMON_DATA.find((record) => record.id === "C-003")).toMatchObject({
      name_en: "Agumon",
      stage: "child",
      sprite: "agumon",
      url: "https://digimon.net/reference_en/detail.php?directory_name=agumon",
    })
    expect(DIGIMON_DATA.find((record) => record.id === "P-007")).toMatchObject({
      name_en: "Andromon",
      stage: "perfect",
      url: "https://digimon.net/reference_en/detail.php?directory_name=andromon",
    })
    expect(DIGIMON_DATA.find((record) => record.id === "SU-011")).toMatchObject({
      name_en: "DarknessBagramon",
      stage: "superUltimate",
      next_evolutions: [],
      url: "https://digimon.net/reference_en/detail.php?directory_name=darknessbagramon",
    })
    expect(DIGIMON_DATA.find((record) => record.id === "SU-008")).toMatchObject({
      name_en: "Chaosdramon",
      url: "https://digimon.net/reference_en/detail.php?directory_name=chaosdramon",
    })
  })

  test("Given the latest source edge cases, when the records load, then the unknown-stage monster resolves through the graph", () => {
    const calumon = DIGIMON_DATA.find((record) => record.id === "UN-001")

    expect(calumon).toMatchObject({ name_en: "Calumon", stage: "unknown", next_evolutions: ["C-112"] })
  })

  test("Given the digitama roster, when field eggs are read, then each family maps to its digitama-stage egg", () => {
    expect(DIGITAMA_FIELD_EGGS).toEqual({
      "deep-savers": "D-001",
      "dragons-roar": "D-002",
      "jungle-troopers": "D-003",
      "metal-empire": "D-004",
      "nature-spirits": "D-005",
      "nightmare-soldiers": "D-006",
      "virus-busters": "D-007",
      "wind-guardians": "D-008",
    })
    expect(DIGIMON_DATA.filter((record) => record.stage === "digitama").map((record) => record.id)).toEqual([
      "D-001",
      "D-002",
      "D-003",
      "D-004",
      "D-005",
      "D-006",
      "D-007",
      "D-008",
    ])
  })

  test("Given the legacy id migration map, when it is loaded, then every old id resolves to a bundled record", () => {
    const dataIds = new Set(DIGIMON_DATA.map((record) => record.id))
    const oldIds = Object.keys(DIGIMON_ID_MIGRATION)

    expect(oldIds).toHaveLength(650)
    for (const oldId of oldIds) expect(oldId).toMatch(/^\d-\d{3}$/)
    for (const newId of Object.values(DIGIMON_ID_MIGRATION)) expect(dataIds.has(newId)).toBeTrue()
  })
})
