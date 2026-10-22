import type { JSX } from "@opentui/solid"

import type { SidebarCardInputs } from "../src/application/models/sidebar-card-inputs.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import type { DigimonStage } from "../src/domain/stage.ts"
import type { MonsterAnimationOutput } from "../src/tui/monster-animation.ts"
import { createTui, type TuiCompositionApi } from "../src/tui.tsx"
import type { VpetTheme } from "../src/tui/theme.ts"

type TuiCompositionKeymap = NonNullable<TuiCompositionApi["keymap"]>
type TuiCompositionLayer = Parameters<TuiCompositionKeymap["registerLayer"]>[0]

type SessionStatusValue =
  | { readonly type: "idle" }
  | { readonly type: "busy" }
  | { readonly type: "retry"; readonly attempt?: number; readonly message?: string }

type ActivityEventMap = {
  readonly "session.text.delta": {
    readonly type: "session.text.delta"
    readonly data: { readonly sessionID: string }
  }
  readonly "session.tool.called": {
    readonly type: "session.tool.called"
    readonly data: { readonly sessionID: string }
  }
  readonly "session.execution.succeeded": {
    readonly type: "session.execution.succeeded"
    readonly data: { readonly sessionID: string }
  }
  readonly "session.status": {
    readonly type: "session.status"
    readonly data: { readonly sessionID: string; readonly status: SessionStatusValue }
  }
}

export type ActivityEvent = ActivityEventMap[keyof ActivityEventMap]
type ActivityHandlers = { [Type in keyof ActivityEventMap]: Set<(event: ActivityEventMap[Type]) => void> }
type ActivitySubscription =
  | readonly [type: "session.text.delta", handler: (event: ActivityEventMap["session.text.delta"]) => void]
  | readonly [type: "session.tool.called", handler: (event: ActivityEventMap["session.tool.called"]) => void]
  | readonly [
      type: "session.execution.succeeded",
      handler: (event: ActivityEventMap["session.execution.succeeded"]) => void,
    ]
  | readonly [type: "session.status", handler: (event: ActivityEventMap["session.status"]) => void]

const emptyHandlers = (): ActivityHandlers => ({
  "session.text.delta": new Set(),
  "session.tool.called": new Set(),
  "session.execution.succeeded": new Set(),
  "session.status": new Set(),
})

const assertNever = (event: never): never => {
  throw new Error(`Unexpected activity event: ${JSON.stringify(event)}`)
}

type PartnerInputOptions = {
  readonly stage?: DigimonStage
  readonly isSetOverride?: boolean
}

export const partnerInputs = (sprite: string, options: PartnerInputOptions = {}): SidebarCardInputs => ({
  kind: "partner",
  node: {
    id: "3-001",
    nameEn: sprite,
    nameJp: sprite,
    nextEvolutions: [],
    sprite,
    stage: options.stage ?? 3,
    url: `https://example.test/${sprite}`,
  },
  gauge: options.isSetOverride ? 0 : 42,
  isTerminal: options.isSetOverride ?? false,
  frozen: false,
  isSetOverride: options.isSetOverride ?? false,
  trainerTotalTokens: 100,
})

export const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

export class FakeTuiScheduler {
  readonly pollCallbacks: (() => void)[] = []
  readonly pollTimeoutMs: number[] = []
  visualCallback: (() => void) | undefined
  visualIntervalMs: number | undefined
  visualStops = 0
  pollStops = 0
  #now = 0

  readonly nowMs = (): number => this.#now

  setNow(now: number): void {
    this.#now = now
  }

  readonly scheduleVisualInterval = (callback: () => void, intervalMs: number): (() => void) => {
    this.visualCallback = callback
    this.visualIntervalMs = intervalMs
    return () => {
      this.visualStops += 1
    }
  }

  readonly schedulePollTimeout = (callback: () => void, intervalMs: number): (() => void) => {
    this.pollCallbacks.push(callback)
    this.pollTimeoutMs.push(intervalMs)
    return () => {
      this.pollStops += 1
    }
  }

  tickVisual(): void {
    if (this.visualCallback === undefined) throw new Error("Expected a visual interval callback")
    this.visualCallback()
  }

  runPoll(index: number): void {
    const callback = this.pollCallbacks[index]
    if (callback === undefined) throw new Error(`Expected poll callback ${index}`)
    callback()
  }
}

export class FakeTuiEventBus {
  readonly subscriptions: (keyof ActivityEventMap)[] = []
  readonly unsubscribeCounts: Record<keyof ActivityEventMap, number> = {
    "session.text.delta": 0,
    "session.tool.called": 0,
    "session.execution.succeeded": 0,
    "session.status": 0,
  }
  readonly #active: ActivityHandlers = emptyHandlers()
  readonly #captured: ActivityHandlers = emptyHandlers()

  readonly on = (...subscription: ActivitySubscription): (() => void) => {
    switch (subscription[0]) {
      case "session.text.delta":
        return this.#subscribe(subscription[0], subscription[1])
      case "session.tool.called":
        return this.#subscribe(subscription[0], subscription[1])
      case "session.execution.succeeded":
        return this.#subscribe(subscription[0], subscription[1])
      case "session.status":
        return this.#subscribe(subscription[0], subscription[1])
    }
  }

  #subscribe<Type extends keyof ActivityEventMap>(
    type: Type,
    handler: (event: ActivityEventMap[Type]) => void,
  ): () => void {
    this.subscriptions.push(type)
    this.#active[type].add(handler)
    this.#captured[type].add(handler)
    return () => {
      this.unsubscribeCounts[type] += 1
      this.#active[type].delete(handler)
    }
  }

  emit(event: ActivityEvent): void {
    this.#dispatch(this.#active, event)
  }

  emitCaptured(event: ActivityEvent): void {
    this.#dispatch(this.#captured, event)
  }

  #dispatch(handlers: ActivityHandlers, event: ActivityEvent): void {
    switch (event.type) {
      case "session.text.delta":
        for (const handler of handlers["session.text.delta"]) handler(event)
        return
      case "session.tool.called":
        for (const handler of handlers["session.tool.called"]) handler(event)
        return
      case "session.execution.succeeded":
        for (const handler of handlers["session.execution.succeeded"]) handler(event)
        return
      case "session.status":
        for (const handler of handlers["session.status"]) handler(event)
        return
      default:
        assertNever(event)
    }
  }
}

export class TuiCompositionHarness {
  readonly scheduler = new FakeTuiScheduler()
  readonly eventBus = new FakeTuiEventBus()
  readonly observed: MonsterAnimationOutput[] = []
  readonly trace: string[] = []
  renderRequests = 0
  slot: (() => JSX.Element) | undefined
  dispose: (() => void | Promise<void>) | undefined

  readonly dialogStack = {
    renders: [] as (() => JSX.Element)[],
    closeCallbacks: [] as (() => void)[],
    sizes: [] as ("medium" | "large" | "xlarge")[],
    replaceCount: 0,
    clearCount: 0,
    replace: (render: () => JSX.Element, onClose?: () => void) => {
      if (this.#disposed) return
      this.dialogStack.renders.push(render)
      if (onClose !== undefined) this.dialogStack.closeCallbacks.push(onClose)
      this.dialogStack.replaceCount += 1
    },
    clear: () => {
      if (this.#disposed) return
      this.dialogStack.clearCount += 1
    },
    setSize: (size: "medium" | "large" | "xlarge") => {
      if (this.#disposed) return
      this.dialogStack.sizes.push(size)
    },
  }

  readonly layers: TuiCompositionLayer[] = []
  readonly layerDisposers: (() => void)[] = []
  readonly #activeLayers = new Set<TuiCompositionLayer>()
  #disposed = false

  readonly keymap = {
    registerLayer: (layer: TuiCompositionLayer) => {
      if (this.#disposed) return () => undefined
      this.layers.push(layer)
      this.#activeLayers.add(layer)
      let disposed = false
      const disposer = () => {
        if (disposed) return
        disposed = true
        this.#activeLayers.delete(layer)
        const idx = this.layerDisposers.indexOf(disposer)
        if (idx >= 0) this.layerDisposers.splice(idx, 1)
      }
      this.layerDisposers.push(disposer)
      return disposer
    },
  }

  invokeCommand(name: string): void {
    if (this.#disposed) return
    for (const layer of this.layers) {
      if (!this.#activeLayers.has(layer)) continue
      for (const command of layer.commands) {
        if (command.id === name || command.slash.name === name) {
          command.run()
          return
        }
      }
    }
  }

  readonly theme = (): VpetTheme => ({ current: {} }) as unknown as VpetTheme

  capturedApi!: Parameters<ReturnType<typeof createTui>>[0]

  async start(
    loadInputs: () => SidebarCardInputs | Promise<SidebarCardInputs>,
    options: { readonly random?: () => number } = {},
  ): Promise<void> {
    await this.startWith(
      createTui(loadInputs, DEFAULT_VPET_SETTINGS, {
        scheduleVisualInterval: this.scheduler.scheduleVisualInterval,
        schedulePollTimeout: this.scheduler.schedulePollTimeout,
        nowMs: this.scheduler.nowMs,
        ...(options.random === undefined ? {} : { random: options.random }),
        onAnimation: (output) => {
          this.observed.push(output)
          this.trace.push("observe")
        },
      }),
    )
  }

  async startWith(compose: ReturnType<typeof createTui>): Promise<void> {
    const api = {
      event: this.eventBus,
      renderer: {
        requestRender: () => {
          this.renderRequests += 1
          this.trace.push("render")
        },
      },
      lifecycle: {
        onDispose: (callback: () => void) => {
          this.dispose = () => {
            this.#disposed = true
            callback()
          }
          return () => undefined
        },
      },
      slots: {
        register: (plugin: Parameters<TuiCompositionApi["slots"]["register"]>[0]) => {
          this.slot = plugin.slots.sidebar_content
          return "opencode-vpet"
        },
      },
      keymap: this.keymap,
      ui: {
        dialog: this.dialogStack,
      },
      theme: this.theme,
    }
    this.capturedApi = api
    await compose(api)
    await settle()
  }
}

export const sessionTextDelta = (sessionID: string): ActivityEventMap["session.text.delta"] => ({
  type: "session.text.delta",
  data: { sessionID },
})

export const sessionToolCalled = (sessionID: string): ActivityEventMap["session.tool.called"] => ({
  type: "session.tool.called",
  data: { sessionID },
})

export const sessionExecutionSucceeded = (sessionID: string): ActivityEventMap["session.execution.succeeded"] => ({
  type: "session.execution.succeeded",
  data: { sessionID },
})

export const sessionStatus = (sessionID: string, status: SessionStatusValue): ActivityEventMap["session.status"] => ({
  type: "session.status",
  data: { sessionID, status },
})
