import { describe, expect, mock, test } from "bun:test"

import type { UsageEvolutionTransition } from "@sbugallo/vpet-core/application/models/usage.ts"

mock.module("../../src/shared/sleep.ts", () => ({
  sleep: async () => {},
}))

import { createSidebarOrchestrator } from "../../src/webview/sidebar/sidebar-orchestrator.ts"
import {
  battleSidebarSnapshot,
  createBattleRepository,
  createCaptureNotification,
  createCaptureSink,
  createSpyAnimationHost,
  nullSidebarSnapshot,
  partnerSidebarSnapshot,
  sequenceRandom,
} from "./test-fixtures.ts"

describe("sidebar orchestrator", () => {
  test("refresh publishes no_partner when snapshot is null", async () => {
    const { sink, models } = createCaptureSink()
    const animationHost = createSpyAnimationHost()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: nullSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost,
      notification: createCaptureNotification(),
    })
    orchestrator.setSink(sink)
    await orchestrator.refresh()
    expect(models.at(-1)?.kind).toBe("no_partner")
    expect(animationHost.syncCalls).toBe(1)
  })

  test("refresh publishes partner payload when snapshot has a partner", async () => {
    const { sink, models } = createCaptureSink()
    const animationHost = createSpyAnimationHost()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost,
      notification: createCaptureNotification(),
    })
    orchestrator.setSink(sink)
    await orchestrator.refresh()
    expect(models.at(-1)?.kind).toBe("partner")
    expect(animationHost.syncCalls).toBe(1)
  })

  test("concurrent refresh calls coalesce instead of publishing once per call", async () => {
    const { sink, models } = createCaptureSink()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost: createSpyAnimationHost(),
      notification: createCaptureNotification(),
    })
    orchestrator.setSink(sink)
    await Promise.all([orchestrator.refresh(), orchestrator.refresh(), orchestrator.refresh()])
    expect(models.length).toBeGreaterThan(0)
    expect(models.length).toBeLessThan(3)
  })

  test("pending battle resolves with victory notification", async () => {
    const { sink } = createCaptureSink()
    const notification = createCaptureNotification()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: battleSidebarSnapshot },
      battleRepository: createBattleRepository("won"),
      animationHost: createSpyAnimationHost(),
      notification,
      random: sequenceRandom([0]),
    })
    orchestrator.setSink(sink)
    await orchestrator.refresh()
    expect(notification.messages.some((message) => message.includes("Victory"))).toBe(true)
  })

  test("pending battle resolves with defeat notification when the player loses", async () => {
    const { sink } = createCaptureSink()
    const notification = createCaptureNotification()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: battleSidebarSnapshot },
      battleRepository: createBattleRepository("lost"),
      animationHost: createSpyAnimationHost(),
      notification,
      random: sequenceRandom([0.99]),
    })
    orchestrator.setSink(sink)
    await orchestrator.refresh()
    expect(notification.messages.some((message) => message.includes("Defeat"))).toBe(true)
  })

  test("queueEvolutionReveal plays reveal on next refresh", async () => {
    const { sink, artworks } = createCaptureSink()
    const notification = createCaptureNotification()
    const evolution: UsageEvolutionTransition = { fromNodeId: "3-001", toNodeId: "4-017" }
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost: createSpyAnimationHost(),
      notification,
    })
    orchestrator.setSink(sink)
    orchestrator.queueEvolutionReveal(evolution)
    await orchestrator.refresh()
    expect(artworks.length).toBeGreaterThan(0)
    expect(notification.messages.some((message) => message.includes("Your partner evolved!"))).toBe(true)
  })

  test("isPresentationInProgress is false after refresh completes", async () => {
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost: createSpyAnimationHost(),
      notification: createCaptureNotification(),
    })
    orchestrator.setSink(createCaptureSink().sink)
    await orchestrator.refresh()
    expect(orchestrator.isPresentationInProgress()).toBe(false)
  })

  test("onPresentationEnd callback runs after battle", async () => {
    let ended = false
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: battleSidebarSnapshot },
      battleRepository: createBattleRepository("won"),
      animationHost: createSpyAnimationHost(),
      notification: createCaptureNotification(),
      random: sequenceRandom([0]),
      onPresentationEnd: () => {
        ended = true
      },
    })
    orchestrator.setSink(createCaptureSink().sink)
    await orchestrator.refresh()
    expect(ended).toBe(true)
  })

  test("setSink routes later refresh payloads to the new sink", async () => {
    const first = createCaptureSink()
    const second = createCaptureSink()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost: createSpyAnimationHost(),
      notification: createCaptureNotification(),
    })
    orchestrator.setSink(first.sink)
    orchestrator.setSink(second.sink)
    await orchestrator.refresh()
    expect(first.models).toHaveLength(0)
    expect(second.models).toHaveLength(1)
  })

  test("refresh without sink configured does not throw", async () => {
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost: createSpyAnimationHost(),
      notification: createCaptureNotification(),
    })
    await expect(orchestrator.refresh()).resolves.toBeUndefined()
  })

  test("getCachedPayload returns the last published model", async () => {
    const { sink } = createCaptureSink()
    const orchestrator = createSidebarOrchestrator({
      snapshotReader: { getSidebarSnapshot: partnerSidebarSnapshot },
      battleRepository: createBattleRepository(),
      animationHost: createSpyAnimationHost(),
      notification: createCaptureNotification(),
    })
    orchestrator.setSink(sink)
    await orchestrator.refresh()
    expect(orchestrator.getCachedPayload()?.kind).toBe("partner")
  })
})
