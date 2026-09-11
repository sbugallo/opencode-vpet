import { describe, expect, spyOn, test } from "bun:test"

import { createSidebarPollLoop } from "../src/tui/sidebar-poll-loop.ts"

describe("sidebar poll loop", () => {
  test("Given a pending database read When the loop starts Then it reads immediately and schedules exactly one next read after completion", async () => {
    let resolveLoad: (() => void) | undefined
    let loadCalls = 0
    let appliedModel = ""
    const scheduled: Array<() => void> = []

    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => {
        loadCalls += 1
        await new Promise<void>((resolve) => {
          resolveLoad = resolve
        })
        return "Agumon"
      },
      apply: (model) => {
        appliedModel = model
      },
      schedule: (callback, intervalMs) => {
        expect(intervalMs).toBe(500)
        scheduled.push(callback)
        return callback
      },
      clear: () => undefined,
    })

    loop.start()

    expect(loadCalls).toBe(1)
    expect(scheduled).toHaveLength(0)

    resolveLoad?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(appliedModel).toBe("Agumon")
    expect(scheduled).toHaveLength(1)

    scheduled[0]?.()

    expect(loadCalls).toBe(2)
    expect(scheduled).toHaveLength(1)
  })

  test("Given a disposed lifecycle When a read completes Then it does not apply or schedule another read", async () => {
    let resolveLoad: (() => void) | undefined
    let applyCalls = 0
    let scheduleCalls = 0

    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => {
        await new Promise<void>((resolve) => {
          resolveLoad = resolve
        })
        return "Agumon"
      },
      apply: () => {
        applyCalls += 1
      },
      schedule: () => {
        scheduleCalls += 1
        return scheduleCalls
      },
      clear: () => undefined,
    })

    loop.start()
    loop.dispose()
    resolveLoad?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(applyCalls).toBe(0)
    expect(scheduleCalls).toBe(0)
  })

  test("Given a scheduled next read When the lifecycle disposes Then it clears the schedule and the callback cannot read again", async () => {
    let loadCalls = 0
    let scheduledCallback: (() => void) | undefined
    let clearedHandle: number | undefined

    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => {
        loadCalls += 1
        return "Agumon"
      },
      apply: () => undefined,
      schedule: (callback) => {
        scheduledCallback = callback
        return 7
      },
      clear: (handle) => {
        clearedHandle = handle
      },
    })

    loop.start()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    loop.dispose()
    scheduledCallback?.()

    expect(clearedHandle).toBe(7)
    expect(loadCalls).toBe(1)
  })

  test("Given a pending read and repeated refreshes When it completes Then it coalesces the requests into one immediate follow-up read", async () => {
    let resolveFirstLoad: (() => void) | undefined
    let loadCalls = 0
    const scheduled: Array<() => void> = []

    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => {
        loadCalls += 1
        if (loadCalls === 1)
          await new Promise<void>((resolve) => {
            resolveFirstLoad = resolve
          })
        return loadCalls
      },
      apply: () => undefined,
      schedule: (callback) => {
        scheduled.push(callback)
        return callback
      },
      clear: () => undefined,
    })

    loop.start()
    loop.refresh()
    loop.refresh()
    resolveFirstLoad?.()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(loadCalls).toBe(2)
    expect(scheduled).toHaveLength(1)
  })

  test("Given a scheduled fallback When refresh runs Then it clears the fallback and starts a single immediate read", async () => {
    let loadCalls = 0
    let cleared = 0
    const scheduled: Array<() => void> = []

    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => ++loadCalls,
      apply: () => undefined,
      schedule: (callback) => {
        scheduled.push(callback)
        return callback
      },
      clear: () => {
        cleared += 1
      },
    })

    loop.start()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    loop.refresh()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(cleared).toBe(1)
    expect(loadCalls).toBe(2)
    expect(scheduled).toHaveLength(2)
  })

  test("Given a disposed loop When refresh runs Then it is inert", async () => {
    let loadCalls = 0
    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => ++loadCalls,
      apply: () => undefined,
      schedule: (callback) => callback,
      clear: () => undefined,
    })

    loop.dispose()
    loop.refresh()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(loadCalls).toBe(0)
  })

  test("Given a rejected first load When a later activity refresh occurs Then it applies the next successful model and retains the fallback", async () => {
    let loadCalls = 0
    const applied: string[] = []
    const scheduled: Array<() => void> = []

    const loop = createSidebarPollLoop({
      intervalMs: 500,
      load: async () => {
        loadCalls += 1
        if (loadCalls === 1) throw new Error("SQLite read interrupted")
        return "Agumon"
      },
      apply: (model) => {
        applied.push(model)
      },
      schedule: (callback) => {
        scheduled.push(callback)
        return callback
      },
      clear: () => undefined,
    })

    const errorSpy = spyOn(console, "error").mockImplementation(() => undefined)
    try {
      loop.start()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      loop.refresh()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "SQLite read interrupted" }))
      expect(applied).toEqual(["Agumon"])
      expect(scheduled).toHaveLength(2)
    } finally {
      errorSpy.mockRestore()
    }
  })
})
