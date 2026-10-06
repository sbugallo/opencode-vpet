import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"

import { createSidebarAnimationHost } from "../../src/webview/sidebar/sidebar-animation-host.ts"
import { createCaptureSink, createManualScheduler, sequenceRandom } from "./test-fixtures.ts"

describe("sidebar animation host", () => {
  test("start and tick posts artwork when visible", async () => {
    const { sink, artworks } = createCaptureSink()
    const scheduler = createManualScheduler()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler,
      random: sequenceRandom([0.5]),
      isVisible: () => true,
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    host.start()
    scheduler.tick()
    await Promise.resolve()
    expect(artworks.length).toBeGreaterThan(0)
    host.stop()
  })

  test("stop prevents further tick posts", async () => {
    const { sink, artworks } = createCaptureSink()
    const scheduler = createManualScheduler()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler,
      random: sequenceRandom([0.5]),
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    host.start()
    scheduler.tick()
    await Promise.resolve()
    const countAfterFirst = artworks.length
    host.stop()
    scheduler.tick()
    await Promise.resolve()
    expect(artworks.length).toBe(countAfterFirst)
  })

  test("isVisible false suppresses tick posts", async () => {
    const { sink, artworks } = createCaptureSink()
    const scheduler = createManualScheduler()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler,
      random: sequenceRandom([0.5]),
      isVisible: () => false,
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    host.start()
    scheduler.tick()
    await Promise.resolve()
    expect(artworks).toHaveLength(0)
  })

  test("playFeedAnimation posts eat frames for a partner with eat clips", async () => {
    const { sink, artworks } = createCaptureSink()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler: createManualScheduler(),
      random: sequenceRandom([0.5]),
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    host.setArtworkWidth(40)
    host.playFeedAnimation()
    await Promise.resolve()
    expect(artworks.length).toBe(1)
    expect(artworks[0]?.trim().length).toBeGreaterThan(0)
  })

  test("presentation blocked suppresses tick posts", async () => {
    const { sink, artworks } = createCaptureSink()
    const scheduler = createManualScheduler()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler,
      random: sequenceRandom([0.5]),
    })
    host.setPresentationBlocked(true)
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    host.start()
    scheduler.tick()
    await Promise.resolve()
    expect(artworks).toHaveLength(0)
  })

  test("setArtworkWidth updates viewport width", async () => {
    const { sink, artworks } = createCaptureSink()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler: createManualScheduler(),
      random: sequenceRandom([0.5]),
    })
    host.setArtworkWidth(80)
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    await host.postCurrentFrame()
    expect(artworks.length).toBe(1)
    expect(host.getArtworkWidth()).toBe(80)
  })

  test("syncPartner change produces different artwork", async () => {
    const { sink, artworks } = createCaptureSink()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler: createManualScheduler(),
      random: sequenceRandom([0.5]),
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    await host.postCurrentFrame()
    host.syncPartner({ sprite: "gabumon", isDigitama: false })
    await host.postCurrentFrame()
    expect(artworks.length).toBe(2)
    expect(artworks[0]).not.toBe(artworks[1])
  })

  test("identical consecutive frames are deduplicated", async () => {
    const { sink, artworks } = createCaptureSink()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler: createManualScheduler(),
      random: sequenceRandom([0.5]),
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    await host.postCurrentFrame()
    await host.postCurrentFrame()
    expect(artworks).toHaveLength(1)
  })

  test("clearArtwork allows reposting the same frame", async () => {
    const { sink, artworks } = createCaptureSink()
    const host = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink,
      scheduler: createManualScheduler(),
      random: sequenceRandom([0.5]),
    })
    host.syncPartner({ sprite: "agumon", isDigitama: false })
    await host.postCurrentFrame()
    host.clearArtwork()
    await host.postCurrentFrame()
    expect(artworks).toHaveLength(2)
  })
})
