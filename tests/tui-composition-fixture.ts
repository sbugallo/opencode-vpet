import type {
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventSessionStatus,
  SessionStatus,
} from "@opencode-ai/sdk/v2"
import type { TuiDialogProps, TuiTheme } from "@opencode-ai/plugin/tui"
import type { JSX } from "@opentui/solid"

import type { SidebarCardInputs } from "../src/application/models/sidebar-card-inputs.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"
import type { DigimonStage } from "../src/domain/stage.ts"
import type { MonsterAnimationOutput } from "../src/tui/monster-animation.ts"
import { createTui, type TuiCompositionApi } from "../src/tui.tsx"

type TuiCompositionKeymap = NonNullable<TuiCompositionApi["keymap"]>
type TuiCompositionLayer = Parameters<TuiCompositionKeymap["registerLayer"]>[0]
type TuiCompositionCommand = NonNullable<TuiCompositionLayer["commands"]>[number]

type ActivityEventMap = {
  readonly "message.updated": EventMessageUpdated
  readonly "message.part.updated": EventMessagePartUpdated
  readonly "session.status": EventSessionStatus
}

type ActivityEvent = ActivityEventMap[keyof ActivityEventMap]
type ActivityHandlers = { [Type in keyof ActivityEventMap]: Set<(event: ActivityEventMap[Type]) => void> }
type ActivitySubscription =
  | readonly [type: "message.updated", handler: (event: EventMessageUpdated) => void]
  | readonly [type: "message.part.updated", handler: (event: EventMessagePartUpdated) => void]
  | readonly [type: "session.status", handler: (event: EventSessionStatus) => void]

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
    "message.updated": 0,
    "message.part.updated": 0,
    "session.status": 0,
  }
  readonly #active: ActivityHandlers = {
    "message.updated": new Set(),
    "message.part.updated": new Set(),
    "session.status": new Set(),
  }
  readonly #captured: ActivityHandlers = {
    "message.updated": new Set(),
    "message.part.updated": new Set(),
    "session.status": new Set(),
  }

  readonly on = (...subscription: ActivitySubscription): (() => void) => {
    switch (subscription[0]) {
      case "message.updated":
        return this.#subscribe(subscription[0], subscription[1])
      case "message.part.updated":
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
      case "message.updated":
        for (const handler of handlers[event.type]) handler(event)
        return
      case "message.part.updated":
        for (const handler of handlers[event.type]) handler(event)
        return
      case "session.status":
        for (const handler of handlers[event.type]) handler(event)
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
  dialogComponentCalls = 0
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

  invokeCommand(name: string, ctx?: Parameters<NonNullable<TuiCompositionCommand["run"]>>[0]): void {
    if (this.#disposed) return
    for (const layer of this.layers) {
      if (!this.#activeLayers.has(layer) || layer.commands === undefined) continue
      for (const cmd of layer.commands) {
        if (cmd.name === name || cmd.slashName === name) {
          if (cmd.run) {
            type RunFn = (context?: typeof ctx) => void
            const run = cmd.run as RunFn
            run(ctx)
          }
          return
        }
      }
    }
  }

  readonly theme = { current: {} } as unknown as TuiTheme

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
        Dialog: (props: TuiDialogProps) => {
          this.dialogComponentCalls += 1
          return props.children ?? null
        },
      },
      theme: this.theme,
    }
    this.capturedApi = api
    await compose(api)
    await settle()
  }
}

export const messageUpdated = (sessionID: string): EventMessageUpdated => ({
  id: `event-message-${sessionID}`,
  type: "message.updated",
  properties: {
    sessionID,
    info: {
      id: `message-${sessionID}`,
      sessionID,
      role: "user",
      time: { created: 1 },
      agent: "build",
      model: { providerID: "provider", modelID: "model" },
    },
  },
})

export const messagePartUpdated = (sessionID: string): EventMessagePartUpdated => ({
  id: `event-part-${sessionID}`,
  type: "message.part.updated",
  properties: {
    sessionID,
    time: 1,
    part: { id: "part", sessionID, messageID: "message", type: "text", text: "delta" },
  },
})

export const sessionStatus = (sessionID: string, status: SessionStatus): EventSessionStatus => ({
  id: `event-status-${sessionID}-${status.type}`,
  type: "session.status",
  properties: { sessionID, status },
})
