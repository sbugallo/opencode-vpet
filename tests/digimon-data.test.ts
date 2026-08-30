import { describe, expect, test } from "bun:test"
import { DIGIMON_DATA } from "../src/data/digimon-data"

const RAW_RECORD_KEYS = ["id", "name_en", "name_jp", "next_evolutions", "sprite", "stage", "url"]

describe("bundled Digimon data", () => {
  test("Given the bundled catalog, when it is loaded, then it preserves every record's schema and links", () => {
    const dataIds = new Set(DIGIMON_DATA.map((record) => record.id))

    expect(DIGIMON_DATA).toHaveLength(650)
    expect(dataIds.size).toBe(DIGIMON_DATA.length)

    for (const record of DIGIMON_DATA) {
      expect(Object.keys(record).sort()).toEqual(RAW_RECORD_KEYS)
      expect(record.stage).toBeGreaterThanOrEqual(0)
      expect(record.stage).toBeLessThanOrEqual(7)
      expect(record.id).toMatch(new RegExp(`^${record.stage}-\\d{3}$`))

      for (const evolutionId of record.next_evolutions) {
        expect(dataIds.has(evolutionId)).toBe(true)
      }
    }
  })

  test("Given the bundled catalog, when representative latest records are loaded, then their evolution data and URLs remain exact", () => {
    expect(DIGIMON_DATA.find((record) => record.id === "5-003")).toMatchObject({
      name_en: "Andromon",
      next_evolutions: ["6-068", "6-091", "6-080", "5-033", "6-143", "6-028", "6-125"],
      url: "https://digimon.net/reference_en/detail.php?directory_name=andromon",
    })
    expect(DIGIMON_DATA.find((record) => record.id === "7-011")).toMatchObject({
      name_en: "DarknessBagramon",
      url: "https://digimon.net/reference_en/detail.php?directory_name=darknessbagramon",
    })
    expect(DIGIMON_DATA.find((record) => record.id === "7-045")).toMatchObject({
      name_en: "Chaosdramon",
      url: "https://digimon.net/reference_en/detail.php?directory_name=chaosdramon",
    })
  })

  test("Given the latest source edge cases, when the public raw data is loaded, then the empty sprite is preserved and the removed node is absent", () => {
    expect(DIGIMON_DATA.find((record) => record.id === "2-033")?.sprite).toBe("")
    expect(DIGIMON_DATA.some((record) => record.id === "7-046")).toBeFalse()
    expect(DIGIMON_DATA.some((record) => record.next_evolutions.includes("7-046"))).toBeFalse()
  })
})
