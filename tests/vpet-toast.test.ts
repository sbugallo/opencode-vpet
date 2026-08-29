import { describe, expect, test } from "bun:test"

import {
  createBestEffortVpetToastNotifier,
  formatVpetToast,
  type VpetToastPayload,
} from "../src/adapters/opencode/vpet-toast.ts"
import type { DigimonCatalog } from "../src/data/catalog.ts"

const nodes = [
  {
    id: "0-001",
    nameEn: "Digitama",
    nameJp: "DigiTama",
    nextEvolutions: [],
    sprite: "egg",
    stage: 0,
    url: "https://example.test/digitama",
  },
  {
    id: "1-001",
    nameEn: "Koromon",
    nameJp: "Koromon JP",
    nextEvolutions: [],
    sprite: "koromon",
    stage: 1,
    url: "https://example.test/koromon",
  },
] as const

const catalog: DigimonCatalog = {
  nodes,
  byId: new Map(nodes.map((node) => [node.id, node])),
}

const spawn = { kind: "spawn", nodeId: "0-001", generation: 2 } as const
const freeze = { kind: "freeze" } as const
const unfreeze = { kind: "unfreeze" } as const
const set = { kind: "set", nodeId: "1-001" } as const
const evolution = { kind: "evolution", fromNodeId: "0-001", toNodeId: "1-001" } as const

const unsuccessfulTransports: readonly (readonly [string, () => boolean | Promise<boolean>])[] = [
  ["false", () => false],
  [
    "synchronous throw",
    () => {
      throw new Error("toast transport failed")
    },
  ],
  ["rejected Promise", () => Promise.reject(new Error("toast transport failed"))],
]

describe("VPet toast presentation", () => {
  test.each([
    [
      "spawn",
      spawn,
      { title: "VPet", message: "Spawned Digitama (Generation 2).", variant: "success", duration: 5_000 },
    ],
    ["freeze", freeze, { title: "VPet", message: "Digimon progression frozen.", variant: "info", duration: 3_000 }],
    [
      "unfreeze",
      unfreeze,
      { title: "VPet", message: "Digimon progression resumed.", variant: "info", duration: 3_000 },
    ],
    ["set", set, { title: "VPet", message: "VPet set to Koromon (1-001).", variant: "info", duration: 3_000 }],
    [
      "evolution",
      evolution,
      { title: "Digi-evolution", message: "Digitama evolved into Koromon!", variant: "success", duration: 5_000 },
    ],
  ] as const)(
    "Given an English catalog and a %s event When formatting Then it returns the approved payload",
    (_name, event, expected) => {
      expect(formatVpetToast(event, "en", catalog)).toEqual(expected)
    },
  )

  test.each([
    [spawn, { title: "VPet", message: "Spawned DigiTama (Generation 2).", variant: "success", duration: 5_000 }],
    [set, { title: "VPet", message: "VPet set to Koromon JP (1-001).", variant: "info", duration: 3_000 }],
    [
      evolution,
      { title: "Digi-evolution", message: "DigiTama evolved into Koromon JP!", variant: "success", duration: 5_000 },
    ],
  ] as const)(
    "Given a Japanese catalog-name setting When formatting a name-bearing event Then it selects nameJp",
    (event, expected) => {
      expect(formatVpetToast(event, "jp", catalog)).toEqual(expected)
    },
  )

  test.each([
    { kind: "spawn", nodeId: "missing", generation: 1 },
    { kind: "set", nodeId: "missing" },
    { kind: "evolution", fromNodeId: "0-001", toNodeId: "missing" },
  ] as const)(
    "Given a missing catalog ID When formatting a name-bearing event Then it produces no payload",
    (event) => {
      expect(formatVpetToast(event, "en", catalog)).toBeUndefined()
    },
  )

  test("Given a true-returning toast transport When the notifier receives a payload Then it calls the transport once", async () => {
    const calls: VpetToastPayload[] = []
    const notifier = createBestEffortVpetToastNotifier(async (payload) => {
      calls.push(payload)
      return true
    })
    const payload = formatVpetToast(spawn, "en", catalog)
    if (payload === undefined) throw new Error("Expected spawn toast payload")

    await notifier(payload)

    expect(calls).toEqual([payload])
  })

  test.each(unsuccessfulTransports)(
    "Given a transport that returns %s When the notifier receives a payload Then it resolves after one attempted call without retry",
    async (_outcome, deliver) => {
      let callCount = 0
      const notifier = createBestEffortVpetToastNotifier(() => {
        callCount += 1
        return deliver()
      })
      const payload = formatVpetToast(freeze, "en", catalog)
      if (payload === undefined) throw new Error("Expected freeze toast payload")

      await notifier(payload)

      expect(callCount).toBe(1)
    },
  )
})
