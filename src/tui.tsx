/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { JSX } from "@opentui/solid"
import { createSignal } from "solid-js"

import { toVpetToastPayload } from "./adapters/opencode/vpet-toast.ts"
import { createSqliteSidebarSnapshotReader } from "./adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteVpetArchiveReader } from "./adapters/sqlite/sqlite-vpet-archive-reader.ts"
import type { SidebarCardInputs } from "./application/models/sidebar-card-inputs.ts"
import type { VpetArchiveReader } from "./application/ports/vpet-archive.ts"
import { getSidebarCardInputs } from "./application/use-cases/get-sidebar-card-inputs.ts"
import { loadGlobalVpetSettings } from "./config/global-vpet-settings.ts"
import type { ResolvedVpetSettings } from "./config/types.ts"
import { DIGIMON_CATALOG } from "./data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "./data/monster-frame-catalog.ts"
import { VpetRpc } from "./rpc.ts"
import { VpetSidebarCard } from "./tui/sidebar-card.tsx"
import { MonsterAnimationController, type MonsterAnimationOutput } from "./tui/monster-animation.ts"
import { createSidebarPollLoop } from "./tui/sidebar-poll-loop.ts"
import { buildSidebarCardModel } from "./tui/sidebar-view-model.ts"
import { toVpetTheme, type VpetTheme } from "./tui/theme.ts"
import { registerVpetCommandLayer, type VpetDialogStack, type VpetKeymapLayer } from "./tui/vpet-command-layer.tsx"

const VISUAL_INTERVAL_MS = 500

const getStringOption = (options: Readonly<Record<string, unknown>>, name: string): string | undefined => {
  const value = options[name]
  return typeof value === "string" ? value : undefined
}

const readerOptions = (
  options: Readonly<Record<string, unknown>>,
): Parameters<typeof createSqliteSidebarSnapshotReader>[0] => {
  const appDataRoot = getStringOption(options, "appDataRoot")
  const databasePath = getStringOption(options, "databasePath")
  return {
    ...(appDataRoot === undefined ? {} : { appDataRoot }),
    ...(databasePath === undefined ? {} : { databasePath }),
  }
}

type TuiSessionStatusEvent = {
  readonly data: {
    readonly status:
      | { readonly type: "idle" }
      | { readonly type: "busy" }
      | { readonly type: "retry"; readonly attempt?: number; readonly message?: string }
  }
}

type ActivitySubscription =
  | readonly [type: "session.status", handler: (event: TuiSessionStatusEvent) => void]
  | readonly [type: "session.text.delta", handler: () => void]
  | readonly [type: "session.tool.called", handler: () => void]
  | readonly [type: "session.execution.succeeded", handler: () => void]

export type TuiCompositionApi = {
  readonly event: { readonly on: (...subscription: ActivitySubscription) => () => void }
  readonly renderer: { readonly requestRender: () => void }
  readonly lifecycle: { readonly onDispose: (callback: () => void) => () => void }
  readonly slots: {
    readonly register: (plugin: { readonly slots: { readonly sidebar_content: () => JSX.Element } }) => string
  }
  readonly keymap?: { readonly registerLayer: (layer: VpetKeymapLayer) => () => void }
  readonly ui?: {
    readonly dialog: VpetDialogStack
  }
  readonly theme?: VpetTheme
}

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
      api.event.on("session.text.delta", activity),
      api.event.on("session.tool.called", activity),
      api.event.on("session.execution.succeeded", activity),
      api.event.on("session.status", (event: TuiSessionStatusEvent) => {
        switch (event.data.status.type) {
          case "busy":
          case "retry":
            activity()
            return
          case "idle":
            return
          default: {
            const unexpectedStatus: never = event.data.status
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
          ? api.keymap.registerLayer({ commands: [] })
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

const plugin = Plugin.define({
  id: "opencode-vpet.tui",
  async setup(context) {
    const reader = createSqliteSidebarSnapshotReader(readerOptions(context.options))
    const archiveReader = createSqliteVpetArchiveReader(readerOptions(context.options))
    const settings = await loadGlobalVpetSettings()

    const cleanups: Array<() => void> = []
    const pushCleanup = (cleanup: () => void): (() => void) => {
      cleanups.push(cleanup)
      return () => {
        const index = cleanups.indexOf(cleanup)
        if (index >= 0) cleanups.splice(index, 1)
      }
    }

    pushCleanup(
      context.client.rpc(VpetRpc).events.on("toast", (event) => {
        const payload = toVpetToastPayload(event.data)
        if (payload !== undefined) context.ui.toast.show(payload)
      }),
    )

    await createTui(() => getSidebarCardInputs(reader, DIGIMON_CATALOG), settings, { archiveReader })({
      event: {
        on: (...subscription) => {
          switch (subscription[0]) {
            case "session.status":
              return context.data.on("session.status", subscription[1])
            case "session.text.delta":
              return context.data.on("session.text.delta", subscription[1])
            case "session.tool.called":
              return context.data.on("session.tool.called", subscription[1])
            case "session.execution.succeeded":
              return context.data.on("session.execution.succeeded", subscription[1])
          }
        },
      },
      renderer: context.renderer,
      lifecycle: { onDispose: pushCleanup },
      slots: {
        register: (registered) => {
          pushCleanup(
            context.ui.slot({
              append: "sidebar.content",
              render: () => registered.slots.sidebar_content(),
            }),
          )
          return "opencode-vpet"
        },
      },
      keymap: {
        registerLayer: (layer) => {
          context.keymap.layer(() => layer)
          return () => undefined
        },
      },
      ui: {
        dialog: {
          replace: (render, onClose) => context.ui.dialog.show(render, onClose),
          clear: () => context.ui.dialog.clear(),
          setSize: (size) => context.ui.dialog.set({ size }),
        },
      },
      theme: toVpetTheme(context.theme),
    })

    return () => {
      for (let index = cleanups.length - 1; index >= 0; index -= 1) cleanups[index]?.()
    }
  },
})

export default plugin
