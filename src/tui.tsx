/** @jsxImportSource @opentui/solid */
import type { PluginOptions } from "@opencode-ai/plugin"
import type { EventMessagePartUpdated, EventMessageUpdated, EventSessionStatus } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiDialogProps, TuiDialogStack, TuiTheme, TuiKeymap } from "@opencode-ai/plugin/tui"
import type { JSX } from "@opentui/solid"
import { createSignal } from "solid-js"

import { createSqliteSidebarSnapshotReader } from "./adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteVpetArchiveReader } from "./adapters/sqlite/sqlite-vpet-archive-reader.ts"
import type { SidebarCardInputs } from "./application/models/sidebar-card-inputs.ts"
import type { VpetArchiveReader } from "./application/ports/vpet-archive.ts"
import { getSidebarCardInputs } from "./application/use-cases/get-sidebar-card-inputs.ts"
import { loadGlobalVpetSettings } from "./config/global-vpet-settings.ts"
import type { ResolvedVpetSettings } from "./config/types.ts"
import { DIGIMON_CATALOG } from "./data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "./data/monster-frame-catalog.ts"
import { VpetSidebarCard } from "./tui/sidebar-card.tsx"
import { MonsterAnimationController, type MonsterAnimationOutput } from "./tui/monster-animation.ts"
import { createSidebarPollLoop } from "./tui/sidebar-poll-loop.ts"
import { buildSidebarCardModel } from "./tui/sidebar-view-model.ts"
import { registerVpetCommandLayer } from "./tui/vpet-command-layer.tsx"

const VISUAL_INTERVAL_MS = 500

const getStringOption = (options: PluginOptions | undefined, name: string): string | undefined => {
  const value = options?.[name]
  return typeof value === "string" ? value : undefined
}

const readerOptions = (options: PluginOptions | undefined): Parameters<typeof createSqliteSidebarSnapshotReader>[0] => {
  const appDataRoot = getStringOption(options, "appDataRoot")
  const databasePath = getStringOption(options, "databasePath")
  return {
    ...(appDataRoot === undefined ? {} : { appDataRoot }),
    ...(databasePath === undefined ? {} : { databasePath }),
  }
}

export type TuiCompositionApi = {
  readonly event: { readonly on: (...subscription: ActivitySubscription) => () => void }
  readonly renderer: { readonly requestRender: () => void }
  readonly lifecycle: { readonly onDispose: (callback: () => void) => () => void }
  readonly slots: {
    readonly register: (plugin: { readonly slots: { readonly sidebar_content: () => JSX.Element } }) => string
  }
  readonly keymap?: { readonly registerLayer: TuiKeymap["registerLayer"] }
  readonly ui?: {
    readonly dialog: Pick<TuiDialogStack, "replace" | "clear" | "setSize">
    readonly Dialog: (props: TuiDialogProps) => JSX.Element
  }
  readonly theme?: TuiTheme
}

type ActivitySubscription =
  | readonly [type: "message.updated", handler: (event: EventMessageUpdated) => void]
  | readonly [type: "message.part.updated", handler: (event: EventMessagePartUpdated) => void]
  | readonly [type: "session.status", handler: (event: EventSessionStatus) => void]

type TuiSchedulingOptions = {
  readonly scheduleVisualInterval?: (callback: () => void, intervalMs: number) => () => void
  readonly schedulePollTimeout?: (callback: () => void, intervalMs: number) => () => void
  readonly nowMs?: () => number
  readonly random?: () => number
  readonly onAnimation?: (output: MonsterAnimationOutput) => void
  readonly archiveReader?: VpetArchiveReader
}

const sameAnimation = (left: MonsterAnimationOutput, right: MonsterAnimationOutput): boolean =>
  left.kind === right.kind &&
  left.result.kind === right.result.kind &&
  (left.result.kind !== "frame" || right.result.kind !== "frame" || left.result.frame === right.result.frame) &&
  (left.result.kind !== "unavailable" ||
    right.result.kind !== "unavailable" ||
    left.result.sprite === right.result.sprite) &&
  left.offset === right.offset &&
  left.facing === right.facing

export const createTui =
  (
    loadInputs: () => SidebarCardInputs | Promise<SidebarCardInputs>,
    settings: ResolvedVpetSettings,
    scheduling: TuiSchedulingOptions = {},
  ) =>
  async (api: TuiCompositionApi): Promise<void> => {
    const [inputs, setInputs] = createSignal<SidebarCardInputs>({ kind: "no_partner" })
    const [animation, setAnimation] = createSignal<MonsterAnimationOutput>({
      kind: "blank",
      result: { kind: "blank" },
      offset: 0,
      facing: "left",
    })
    const controller = new MonsterAnimationController(
      MONSTER_FRAME_CATALOG,
      scheduling.random ?? Math.random,
      scheduling.nowMs,
    )
    let disposed = false
    const publish = (nextAnimation: MonsterAnimationOutput): boolean => {
      if (sameAnimation(animation(), nextAnimation)) return false
      setAnimation(nextAnimation)
      return true
    }
    const syncAnimation = (nextInputs: SidebarCardInputs): void => {
      const cardModel = buildSidebarCardModel(nextInputs, settings)
      publish(
        controller.dispatch({
          kind: "partner_changed",
          partner:
            cardModel.kind === "partner"
              ? { sprite: cardModel.sprite, isDigitama: cardModel.stageNumber === 0 }
              : undefined,
        }),
      )
    }
    const poller = createSidebarPollLoop({
      intervalMs: VISUAL_INTERVAL_MS,
      load: async () => loadInputs(),
      apply: (nextInputs) => {
        setInputs(nextInputs)
        syncAnimation(nextInputs)
        api.renderer.requestRender()
      },
      schedule: (callback, intervalMs) =>
        (
          scheduling.schedulePollTimeout ??
          ((scheduledCallback, delay) => {
            const handle = setTimeout(scheduledCallback, delay)
            return () => clearTimeout(handle)
          })
        )(callback, intervalMs),
      clear: (stop) => stop(),
    })
    const stopVisualInterval = (
      scheduling.scheduleVisualInterval ??
      ((callback, intervalMs) => {
        const handle = setInterval(callback, intervalMs)
        return () => clearInterval(handle)
      })
    )(() => {
      if (disposed) return
      const nextAnimation = controller.dispatch({ kind: "tick" })
      publish(nextAnimation)
      scheduling.onAnimation?.(nextAnimation)
      api.renderer.requestRender()
    }, VISUAL_INTERVAL_MS)

    const activity = (): void => {
      if (disposed) return
      poller.refresh()
      if (publish(controller.dispatch({ kind: "activity" }))) api.renderer.requestRender()
    }
    const unsubscribes = [
      api.event.on("message.updated", activity),
      api.event.on("message.part.updated", activity),
      api.event.on("session.status", (event: EventSessionStatus) => {
        switch (event.properties.status.type) {
          case "busy":
          case "retry":
            activity()
            return
          case "idle":
            return
          default: {
            const unexpectedStatus: never = event.properties.status
            return unexpectedStatus
          }
        }
      }),
    ]

    poller.start()

    const disposeLayer =
      api.keymap === undefined || api.ui === undefined || api.theme === undefined
        ? () => undefined
        : scheduling.archiveReader === undefined
          ? api.keymap.registerLayer({
              name: "opencode-vpet.layer",
              namespace: "opencode-vpet",
              commands: [],
            })
          : registerVpetCommandLayer({
              api: { keymap: api.keymap, ui: api.ui, theme: api.theme },
              reader: scheduling.archiveReader,
              catalog: DIGIMON_CATALOG,
              settings,
              isDisposed: () => disposed,
            })

    api.lifecycle.onDispose(() => {
      if (disposed) return
      disposed = true
      disposeLayer()
      poller.dispose()
      stopVisualInterval()
      for (const unsubscribe of unsubscribes) unsubscribe()
    })

    api.slots.register({
      slots: {
        sidebar_content() {
          return (
            <VpetSidebarCard
              model={() => buildSidebarCardModel(inputs(), settings)}
              animation={animation}
              onArtworkWidthChange={(width) => {
                if (disposed) return
                if (publish(controller.dispatch({ kind: "viewport_resized", width }))) api.renderer.requestRender()
              }}
            />
          )
        },
      },
    })
  }

export const tui: TuiPlugin = async (api, options) => {
  const reader = createSqliteSidebarSnapshotReader(readerOptions(options))
  const archiveReader = createSqliteVpetArchiveReader(readerOptions(options))
  const settings = await loadGlobalVpetSettings()
  await createTui(() => getSidebarCardInputs(reader, DIGIMON_CATALOG), settings, { archiveReader })({
    event: {
      on: (...subscription) => {
        switch (subscription[0]) {
          case "message.updated":
            return api.event.on(subscription[0], subscription[1])
          case "message.part.updated":
            return api.event.on(subscription[0], subscription[1])
          case "session.status":
            return api.event.on(subscription[0], subscription[1])
        }
      },
    },
    renderer: api.renderer,
    lifecycle: api.lifecycle,
    slots: api.slots,
    keymap: { registerLayer: api.keymap.registerLayer.bind(api.keymap) },
    ui: {
      dialog: {
        replace: api.ui.dialog.replace.bind(api.ui.dialog),
        clear: api.ui.dialog.clear.bind(api.ui.dialog),
        setSize: api.ui.dialog.setSize.bind(api.ui.dialog),
      },
      Dialog: api.ui.Dialog,
    },
    theme: api.theme,
  })
}

const plugin = { id: "opencode-vpet", tui } as const

export default plugin
