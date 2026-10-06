import { describe, expect, test } from "bun:test"

import { normalizeDigitalPetSettings } from "@jcendal/digital-pet-core/config/normalize.ts"
import {
  STAGE_THRESHOLD_KEYS,
  DIGITAL_PET_LANGUAGES,
  type ResolvedDigitalPetSettings,
} from "@jcendal/digital-pet-core/config/types.ts"

const expectedDefaults = {
  language: "jp",
  notifications: true,
  stageLabels: {
    en: {
      egg: "DigiEgg",
      babyI: "In Training I",
      babyII: "In Training II",
      child: "Rookie",
      adult: "Champion",
      perfect: "Ultimate",
      ultimate: "Mega",
      superUltimate: "Ultra",
    },
    jp: {
      egg: "Digitama",
      babyI: "Baby I",
      babyII: "Baby II",
      child: "Child",
      adult: "Adult",
      perfect: "Perfect",
      ultimate: "Ultimate",
      superUltimate: "SuperUltimate",
    },
  },
  stageThresholds: {
    egg: 5_000_000,
    babyI: 10_000_000,
    babyII: 20_000_000,
    child: 40_000_000,
    adult: 75_000_000,
    perfect: 125_000_000,
    ultimate: 200_000_000,
    superUltimate: 300_000_000,
  },
} as const satisfies ResolvedDigitalPetSettings

const happyCases: readonly [string, unknown, ResolvedDigitalPetSettings][] = [
  ["empty object", {}, expectedDefaults],
  [
    "complete English config",
    {
      language: "en",
      notifications: false,
      stageThresholds: {
        egg: 11,
        babyI: 22,
        babyII: 33,
        child: 44,
        adult: 55,
        perfect: 66,
        ultimate: 77,
        superUltimate: 88,
      },
    },
    {
      ...expectedDefaults,
      language: "en",
      notifications: false,
      stageThresholds: {
        egg: 11,
        babyI: 22,
        babyII: 33,
        child: 44,
        adult: 55,
        perfect: 66,
        ultimate: 77,
        superUltimate: 88,
      },
    },
  ],
  [
    "partial Japanese config",
    { language: "jp", stageThresholds: { child: 777 } },
    {
      ...expectedDefaults,
      stageThresholds: { ...expectedDefaults.stageThresholds, child: 777 },
    },
  ],
]

const fallbackCases: readonly [string, unknown, ResolvedDigitalPetSettings][] = [
  ["null root", null, expectedDefaults],
  ["array root", [], expectedDefaults],
  ["scalar root", "jp", expectedDefaults],
  [
    "unsupported fields and invalid thresholds",
    {
      language: "fr",
      unknown: true,
      stageThresholds: {
        egg: 0,
        babyI: -1,
        babyII: 1.5,
        child: Number.MAX_SAFE_INTEGER + 1,
        adult: Number.POSITIVE_INFINITY,
        perfect: Number.NaN,
        ultimate: "5",
        superUltimate: 88,
        unknown: 99,
      },
    },
    {
      ...expectedDefaults,
      stageThresholds: { ...expectedDefaults.stageThresholds, superUltimate: 88 },
    },
  ],
  ["wrong threshold container", { language: true, stageThresholds: [11, 22] }, expectedDefaults],
]

describe("digital-pet settings normalization", () => {
  test.each(happyCases)(
    "Given %s When normalizing Then it returns the exact resolved settings",
    (_name, input, expected) => {
      expect(normalizeDigitalPetSettings(input)).toEqual(expected)
    },
  )

  test.each(fallbackCases)(
    "Given %s When normalizing Then it independently falls back without throwing",
    (_name, input, expected) => {
      expect(() => normalizeDigitalPetSettings(input)).not.toThrow()
      expect(normalizeDigitalPetSettings(input)).toEqual(expected)
    },
  )

  test.each([
    ["omitted", {}, true],
    ["literal true", { notifications: true }, true],
    ["literal false", { notifications: false }, false],
    ["string", { notifications: "false" }, true],
    ["number", { notifications: 0 }, true],
    ["object", { notifications: {} }, true],
    [
      "throwing accessor",
      Object.defineProperty({}, "notifications", {
        get: () => {
          throw new Error("notifications")
        },
      }),
      true,
    ],
  ] as const)(
    "Given %s notifications When normalizing Then only literal booleans survive",
    (_name, input, expected) => {
      expect(normalizeDigitalPetSettings(input).notifications).toBe(expected)
    },
  )

  test("Given invalid notifications with valid language and threshold siblings When normalizing Then sibling values survive", () => {
    const settings = normalizeDigitalPetSettings({
      language: "en",
      notifications: "false",
      stageThresholds: { child: 777 },
    })

    expect(settings.language).toBe("en")
    expect(settings.notifications).toBeTrue()
    expect(settings.stageThresholds.child).toBe(777)
  })

  test("Given resolved settings When mutation is attempted Then every resolved layer is frozen", () => {
    const settings = normalizeDigitalPetSettings({})

    expect(Object.isFrozen(settings)).toBeTrue()
    expect(Object.isFrozen(settings.stageThresholds)).toBeTrue()
    expect(Object.isFrozen(settings.stageLabels)).toBeTrue()
    expect(Object.isFrozen(settings.stageLabels.en)).toBeTrue()
    expect(Object.isFrozen(settings.stageLabels.jp)).toBeTrue()
  })

  test.each([
    [
      "root getter",
      Object.defineProperty({}, "stageThresholds", {
        get: () => {
          throw new Error("root")
        },
      }),
      40_000_000,
    ],
    [
      "language getter",
      Object.defineProperty({}, "language", {
        get: () => {
          throw new Error("language")
        },
      }),
      40_000_000,
    ],
    [
      "stageThresholds getter",
      Object.defineProperty({}, "stageThresholds", {
        get: () => {
          throw new Error("thresholds")
        },
      }),
      40_000_000,
    ],
    [
      "threshold getter with valid sibling",
      {
        stageThresholds: Object.defineProperties(
          { child: 777 },
          {
            egg: {
              get: () => {
                throw new Error("egg")
              },
            },
          },
        ),
      },
      777,
    ],
    [
      "root Proxy get trap",
      new Proxy(
        {},
        {
          get: () => {
            throw new Error("proxy root")
          },
        },
      ),
      40_000_000,
    ],
    [
      "threshold Proxy get trap with valid sibling",
      {
        stageThresholds: new Proxy(
          { child: 777 },
          {
            get: (_target, key) =>
              key === "egg"
                ? (() => {
                    throw new Error("proxy egg")
                  })()
                : key === "child"
                  ? 777
                  : undefined,
          },
        ),
      },
      777,
    ],
  ])(
    "Given a throwing %s When normalizing Then it falls back without losing valid siblings",
    (_name, input, expectedChild) => {
      expect(() => normalizeDigitalPetSettings(input)).not.toThrow()
      expect(normalizeDigitalPetSettings(input).stageThresholds.child).toBe(expectedChild)
    },
  )

  test("Given public config collections When push mutation is attempted Then both exports remain frozen", () => {
    expect(Object.isFrozen(DIGITAL_PET_LANGUAGES)).toBeTrue()
    expect(Object.isFrozen(STAGE_THRESHOLD_KEYS)).toBeTrue()
    expect(() => Reflect.apply(Array.prototype.push, DIGITAL_PET_LANGUAGES, ["en"])).toThrow()
    expect(() => Reflect.apply(Array.prototype.push, STAGE_THRESHOLD_KEYS, ["egg"])).toThrow()
    expect(DIGITAL_PET_LANGUAGES).toEqual(["en", "jp"])
    expect(STAGE_THRESHOLD_KEYS).toEqual([
      "egg",
      "babyI",
      "babyII",
      "child",
      "adult",
      "perfect",
      "ultimate",
      "superUltimate",
    ])
  })
})
