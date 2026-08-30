import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"

import type { SidebarCardInputs } from "../src/application/models/sidebar-card-inputs.ts"
import type { VpetArchiveResult } from "../src/application/models/vpet-archive.ts"
import type { VpetArchiveReader } from "../src/application/ports/vpet-archive.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import { MONSTER_FRAME_CATALOG } from "../src/data/monster-frame-catalog.ts"
import { createTui } from "../src/tui.tsx"
import {
  messagePartUpdated,
  messageUpdated,
  partnerInputs,
  sessionStatus,
  settle,
  TuiCompositionHarness,
} from "./tui-composition-fixture.ts"

const visibleFrame = (harness: TuiCompositionHarness, index: number) => {
  const output = harness.observed[index]
  if (output === undefined || output.result.kind !== "frame") throw new Error(`Expected observed frame ${index}`)
  return { frame: output.result.frame, offset: output.offset }
}

const lastKind = (harness: TuiCompositionHarness): string | undefined =>
  harness.observed[harness.observed.length - 1]?.kind

const catalogFrame = (sprite: string, frameName: "walk_1" | "walk_2") => {
  const frame = MONSTER_FRAME_CATALOG.get(sprite, frameName)
  if (frame === undefined) throw new Error(`Expected ${sprite}/${frameName}`)
  return frame
}

const sequenceRandom = (...values: readonly number[]) => {
  let calls = 0
  return { random: (): number => values[calls++] ?? 0, calls: (): number => calls }
}

const expectMountedFrame = (frame: string, sprite: string, frameName: "walk_1" | "walk_2", offset: number): void => {
  const left = Math.floor((80 - 16) / 2) + offset
  for (const [index, row] of catalogFrame(sprite, frameName).content.split("\n").entries()) {
    expect(frame.split("\n")[index + 1]?.slice(left, left + 16)).toBe(row)
  }
}

const sleepAtThreshold = (harness: TuiCompositionHarness, now: number): void => {
  harness.scheduler.setNow(now)
  harness.scheduler.tickVisual()
  expect(lastKind(harness)).toBe("sleeping")
}

const archiveWithAgumon: VpetArchiveResult = {
  kind: "available",
  partners: [
    {
      partnerId: "partner-1",
      generation: 1,
      createdAt: "2026-08-24T00:00:00.000Z",
      retiredAt: null,
      events: [
        {
          eventId: "event-1",
          currentNodeId: "3-001",
          createdAt: "2026-08-24T00:00:00.000Z",
        },
      ],
    },
  ],
}

describe("TUI composition", () => {
  test("Given an archive reader When the Dex and history commands run Then they register palette metadata, reread, replace one dialog, clear on close, and become inert after disposal", async () => {
    let reads = 0
    const archiveReader: VpetArchiveReader = {
      getArchive: () => {
        reads += 1
        return archiveWithAgumon
      },
    }
    const harness = new TuiCompositionHarness()
    const compose = createTui(() => partnerInputs("agumon"), DEFAULT_VPET_SETTINGS, { archiveReader })

    await harness.startWith(compose)
    const layer = harness.layers[0]
    const commands = layer?.commands
    if (commands === undefined) throw new Error("Expected VPet command layer")

    expect(
      commands.map((command) => ({
        name: command.name,
        slashName: command.slashName,
        namespace: command.namespace,
        category: command.category,
      })),
    ).toEqual([
      { name: "vpet.dex", slashName: "vpet-dex", namespace: "palette", category: "VPet" },
      { name: "vpet.history", slashName: "vpet-history", namespace: "palette", category: "VPet" },
    ])

    harness.invokeCommand("vpet-dex")
    harness.invokeCommand("vpet.history")
    expect(reads).toBe(2)
    expect(harness.dialogStack.replaceCount).toBe(2)

    const historyDialog = harness.dialogStack.renders[1]
    if (historyDialog === undefined) throw new Error("Expected history dialog render")
    const close = harness.dialogStack.closeCallbacks[1]
    if (close === undefined) throw new Error("Expected dialog close callback")
    close()
    expect(harness.dialogStack.clearCount).toBe(1)

    harness.invokeCommand("vpet-history")
    expect(reads).toBe(3)
    expect(harness.dialogStack.replaceCount).toBe(3)

    await harness.dispose?.()
    harness.invokeCommand("vpet.dex")
    expect(reads).toBe(3)
    expect(harness.dialogStack.replaceCount).toBe(3)
  })

  test("Given an archive reader that throws When either archive command runs Then it opens one safe unavailable dialog instead of rejecting", async () => {
    const archiveReader: VpetArchiveReader = {
      getArchive: () => {
        throw new Error("reader interrupted")
      },
    }
    const harness = new TuiCompositionHarness()
    await harness.startWith(createTui(() => partnerInputs("agumon"), DEFAULT_VPET_SETTINGS, { archiveReader }))

    harness.invokeCommand("vpet.dex")
    expect(harness.dialogStack.replaceCount).toBe(1)
    expect(harness.dialogStack.closeCallbacks).toHaveLength(1)
    await harness.dispose?.()
  })

  test("Given a composed TUI When examining the keymap layer Then it registers a composable namespace and generic metadata fixture works", async () => {
    const harness = new TuiCompositionHarness()
    await harness.start(async () => partnerInputs("agumon"))

    expect(harness.layers).toHaveLength(1)
    const layer = harness.layers[0]
    expect(layer?.name).toBe("opencode-vpet.layer")
    expect(layer?.namespace).toBe("opencode-vpet")
    expect(layer?.commands).toEqual([])

    let testCommandRun = 0
    const disposeTestLayer = harness.keymap.registerLayer({
      name: "test.layer",
      commands: [
        {
          name: "test.command",
          title: "Test",
          run: () => {
            testCommandRun += 1
            harness.dialogStack.replace(() => undefined as unknown as import("@opentui/solid").JSX.Element)
          },
        },
      ],
    })

    harness.invokeCommand("test.command")
    expect(testCommandRun).toBe(1)
    expect(harness.dialogStack.replaceCount).toBe(1)

    harness.dialogStack.clear()
    expect(harness.dialogStack.clearCount).toBe(1)

    disposeTestLayer()
    harness.invokeCommand("test.command")
    expect(testCommandRun).toBe(1)

    await harness.dispose?.()
    expect(harness.layerDisposers).toHaveLength(0)

    const ui = harness.capturedApi.ui
    if (ui === undefined) throw new Error("Expected dialog API")
    ui.dialog.replace(() => undefined)
    ui.dialog.clear()

    expect(harness.dialogStack.replaceCount).toBe(1)
    expect(harness.dialogStack.clearCount).toBe(1)
  })

  test("Given a loaded partner When the first visual callback runs Then it advances before publication and requests one render afterward", async () => {
    const harness = new TuiCompositionHarness()
    await harness.start(() => partnerInputs("agumon"))
    harness.trace.length = 0

    harness.scheduler.tickVisual()

    expect(harness.scheduler.visualIntervalMs).toBe(500)
    expect(harness.scheduler.pollTimeoutMs).toEqual([500])
    expect(visibleFrame(harness, 0).frame).toBe(catalogFrame("agumon", "walk_2"))
    expect(harness.trace).toEqual(["observe", "render"])
    await harness.dispose?.()
  })

  test("Given same and changed poll identities When polls complete between ticks Then polling never advances phase and evolution resets once", async () => {
    const harness = new TuiCompositionHarness()
    let inputs: SidebarCardInputs = partnerInputs("agumon")
    await harness.start(() => inputs)

    harness.scheduler.tickVisual()
    harness.scheduler.runPoll(0)
    await settle()
    harness.scheduler.tickVisual()
    inputs = partnerInputs("gatomon")
    harness.scheduler.runPoll(1)
    await settle()
    harness.scheduler.tickVisual()

    expect(
      harness.observed.map((output) => (output.result.kind === "frame" ? output.result.frame : undefined)),
    ).toEqual([catalogFrame("agumon", "walk_2"), catalogFrame("agumon", "walk_1"), catalogFrame("gatomon", "walk_2")])
    await harness.dispose?.()
  })

  test("Given a mounted canonical egg When activity polling hatches it to a canonical partner Then the retained width resets, moves, and enters a deterministic cosmetic action without another resize", async () => {
    const source = sequenceRandom(0, 0)
    const harness = new TuiCompositionHarness()
    let inputs: SidebarCardInputs = partnerInputs("egg", { stage: 0 })
    await harness.start(() => inputs, { random: source.random })
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()

    harness.scheduler.tickVisual()
    expect(harness.observed).toEqual([expect.objectContaining({ kind: "digitama", offset: 0, facing: "left" })])
    expect(source.calls()).toBe(0)

    inputs = partnerInputs("agumon", { stage: 3 })
    harness.eventBus.emit(messageUpdated("hatch"))
    await settle()
    await setup.renderOnce()

    expectMountedFrame(setup.captureCharFrame(), "agumon", "walk_1", 0)
    for (let tick = 0; tick < 6; tick += 1) harness.scheduler.tickVisual()

    expect(harness.observed.slice(1).map(({ kind, offset, facing }) => ({ kind, offset, facing }))).toEqual([
      { kind: "walking", offset: -1, facing: "left" },
      { kind: "walking", offset: -2, facing: "left" },
      { kind: "walking", offset: -3, facing: "left" },
      { kind: "walking", offset: -4, facing: "left" },
      { kind: "walking", offset: -5, facing: "left" },
      { kind: "action", offset: -5, facing: "left" },
    ])
    expect(source.calls()).toBe(2)
    setup.renderer.destroy()
    await harness.dispose?.()
  })

  test("Given a mounted normal partner When activity refreshes a different stage-positive set override Then the retained width resets, moves, and enters a deterministic cosmetic action without another resize", async () => {
    const source = sequenceRandom(0, 0, 0)
    const harness = new TuiCompositionHarness()
    let inputs: SidebarCardInputs = partnerInputs("agumon", { stage: 3 })
    await harness.start(() => inputs, { random: source.random })
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()

    inputs = partnerInputs("gatomon", { stage: 4, isSetOverride: true })
    harness.eventBus.emit(messageUpdated("set"))
    await settle()
    await setup.renderOnce()

    expect(setup.captureCharFrame()).toContain("gatomon (set)")
    expectMountedFrame(setup.captureCharFrame(), "gatomon", "walk_1", 0)
    for (let tick = 0; tick < 6; tick += 1) harness.scheduler.tickVisual()

    expect(harness.observed.map(({ kind, offset, facing }) => ({ kind, offset, facing }))).toEqual([
      { kind: "walking", offset: -1, facing: "left" },
      { kind: "walking", offset: -2, facing: "left" },
      { kind: "walking", offset: -3, facing: "left" },
      { kind: "walking", offset: -4, facing: "left" },
      { kind: "walking", offset: -5, facing: "left" },
      { kind: "action", offset: -5, facing: "left" },
    ])
    expect(source.calls()).toBe(3)
    setup.renderer.destroy()
    await harness.dispose?.()
  })

  test("Given project-wide activity events When parent and child sessions wake a sleeping partner Then all accepted events are equivalent and idle is inert", async () => {
    const harness = new TuiCompositionHarness()
    await harness.start(() => partnerInputs("agumon"))
    const accepted = [
      messageUpdated("parent"),
      messagePartUpdated("child"),
      sessionStatus("child", { type: "busy" }),
      sessionStatus("parent", { type: "retry", attempt: 1, message: "retry", next: 2 }),
    ] as const

    for (const [index, event] of accepted.entries()) {
      sleepAtThreshold(harness, (index + 1) * 300_000)
      const rendersBeforeActivity = harness.renderRequests
      harness.eventBus.emit(event)
      expect(harness.renderRequests).toBe(rendersBeforeActivity + 1)
      harness.scheduler.tickVisual()
      expect(lastKind(harness)).toBe("walking")
    }
    sleepAtThreshold(harness, 1_500_000)
    const rendersBeforeIdle = harness.renderRequests

    harness.eventBus.emit(sessionStatus("parent", { type: "idle" }))

    expect(lastKind(harness)).toBe("sleeping")
    expect(harness.renderRequests).toBe(rendersBeforeIdle)
    expect(harness.eventBus.subscriptions).toEqual(["message.updated", "message.part.updated", "session.status"])
    await harness.dispose?.()
  })

  test("Given mutable sidebar inputs When activity follows freeze and unfreeze commands Then the mounted card updates without recreating the TUI", async () => {
    const harness = new TuiCompositionHarness()
    let inputs = partnerInputs("agumon")
    await harness.start(() => inputs)
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()

    expect(setup.captureCharFrame()).not.toContain("(frozen)")

    if (inputs.kind === "partner") inputs = { ...inputs, frozen: true }
    harness.eventBus.emit(messageUpdated("freeze"))
    await settle()
    await setup.renderOnce()

    expect(setup.captureCharFrame()).toContain("Child (frozen)")

    if (inputs.kind === "partner") inputs = { ...inputs, frozen: false }
    harness.eventBus.emit(messagePartUpdated("unfreeze"))
    await settle()
    await setup.renderOnce()

    expect(setup.captureCharFrame()).not.toContain("(frozen)")
    setup.renderer.destroy()
    await harness.dispose?.()
  })

  test("Given mutable sidebar inputs When activity follows set and spawn commands Then the name marker appears and disappears without recreating the TUI", async () => {
    const harness = new TuiCompositionHarness()
    let inputs = partnerInputs("agumon")
    await harness.start(() => inputs)
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()

    expect(setup.captureCharFrame()).not.toContain("(set)")

    if (inputs.kind === "partner") inputs = { ...inputs, isSetOverride: true, gauge: 0, isTerminal: true }
    harness.eventBus.emit(messageUpdated("set"))
    await settle()
    await setup.renderOnce()

    const setFrame = setup.captureCharFrame()
    expect(setFrame).toContain("agumon (set)")
    expect(setFrame).not.toContain("(frozen)")

    if (inputs.kind === "partner") inputs = { ...inputs, isSetOverride: false, gauge: 42, isTerminal: false }
    harness.eventBus.emit(messagePartUpdated("spawn"))
    await settle()
    await setup.renderOnce()

    expect(setup.captureCharFrame()).not.toContain("(set)")
    setup.renderer.destroy()
    await harness.dispose?.()
  })

  test("Given repeated activity during a pending refresh When the read completes Then it performs one coalesced follow-up", async () => {
    const harness = new TuiCompositionHarness()
    let inputs: SidebarCardInputs = partnerInputs("agumon")
    let loadCalls = 0
    let resolveRefresh: (() => void) | undefined
    await harness.start(async () => {
      loadCalls += 1
      if (loadCalls === 2)
        await new Promise<void>((resolve) => {
          resolveRefresh = resolve
        })
      return inputs
    })
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()

    if (inputs.kind === "partner") inputs = { ...inputs, frozen: true }
    harness.eventBus.emit(messageUpdated("freeze"))
    harness.eventBus.emit(messagePartUpdated("freeze"))

    expect(loadCalls).toBe(2)
    resolveRefresh?.()
    await settle()
    await setup.renderOnce()

    expect(loadCalls).toBe(3)
    expect(setup.captureCharFrame()).toContain("Child (frozen)")
    setup.renderer.destroy()
    await harness.dispose?.()
  })

  test("Given an awake partner When busy activity resets its baseline Then it sleeps only at the new exact threshold without an activity render", async () => {
    const harness = new TuiCompositionHarness()
    await harness.start(() => partnerInputs("agumon"))
    harness.scheduler.setNow(100_000)
    const rendersBeforeActivity = harness.renderRequests

    harness.eventBus.emit(sessionStatus("subagent", { type: "busy" }))
    harness.scheduler.setNow(399_999)
    harness.scheduler.tickVisual()
    expect(lastKind(harness)).toBe("walking")
    harness.scheduler.setNow(400_000)
    harness.scheduler.tickVisual()

    expect(lastKind(harness)).toBe("sleeping")
    expect(rendersBeforeActivity).toBe(1)
    expect(harness.renderRequests).toBe(3)
    await harness.dispose?.()
  })

  test("Given a rendered artwork viewport When widths change Then integer widths reach the controller without render-driven advancement", async () => {
    const harness = new TuiCompositionHarness()
    await harness.start(() => partnerInputs("agumon"))
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()
    expect(harness.observed).toHaveLength(0)

    harness.scheduler.tickVisual()
    expect(visibleFrame(harness, 0).offset).toBe(-1)
    setup.renderer.resize(15, 24)
    await setup.flush()
    const observationsBeforeNarrowTick = harness.observed.length
    harness.scheduler.tickVisual()

    expect(harness.observed).toHaveLength(observationsBeforeNarrowTick + 1)
    expect(visibleFrame(harness, 1).offset).toBe(0)
    setup.renderer.destroy()
    await harness.dispose?.()
  })

  test("Given an open dialog When the harness is disposed Then it handles it without errors", async () => {
    let _reads = 0
    const archiveReader: VpetArchiveReader = {
      getArchive: () => {
        _reads += 1
        return archiveWithAgumon
      },
    }
    const harness = new TuiCompositionHarness()
    await harness.startWith(createTui(() => partnerInputs("agumon"), DEFAULT_VPET_SETTINGS, { archiveReader }))

    harness.invokeCommand("vpet-dex")
    expect(harness.dialogStack.renders).toHaveLength(1)

    await harness.dispose?.()

    expect(harness.dialogStack.replaceCount).toBe(1)
  })

  test("Given captured lifecycle callbacks When disposal repeats Then every resource stops once and every later callback is inert", async () => {
    const harness = new TuiCompositionHarness()
    await harness.start(() => partnerInputs("agumon"))
    if (harness.slot === undefined) throw new Error("Expected sidebar slot")
    const setup = await testRender(harness.slot, { width: 80, height: 24 })
    await setup.flush()
    const rendersBeforeDispose = harness.renderRequests

    await harness.dispose?.()
    await harness.dispose?.()
    harness.scheduler.tickVisual()
    harness.scheduler.runPoll(0)
    harness.eventBus.emitCaptured(sessionStatus("child", { type: "busy" }))
    setup.renderer.resize(60, 24)
    await settle()

    expect(harness.observed).toEqual([])
    expect(harness.renderRequests).toBe(rendersBeforeDispose)
    expect(harness.scheduler.visualStops).toBe(1)
    expect(harness.scheduler.pollStops).toBe(1)
    expect(harness.eventBus.unsubscribeCounts).toEqual({
      "message.updated": 1,
      "message.part.updated": 1,
      "session.status": 1,
    })
    setup.renderer.destroy()
  })
})
