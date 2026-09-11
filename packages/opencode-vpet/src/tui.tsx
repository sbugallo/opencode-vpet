/** @jsxImportSource @opentui/solid */
import type { PluginOptions } from "@opencode-ai/plugin"
import type { EventMessagePartUpdated, EventMessageUpdated, EventSessionStatus } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiDialogProps, TuiDialogStack, TuiTheme, TuiKeymap } from "@opencode-ai/plugin/tui"
import type { JSX } from "@opentui/solid"
import { createSignal } from "solid-js"

import type { SidebarCardInputs } from "@sbugallo/vpet-core/application/models/sidebar-card-inputs.ts"
import type { SidebarSnapshot } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import type { VpetArchiveReader } from "@sbugallo/vpet-core/application/ports/vpet-archive.ts"
import { getSidebarCardInputs } from "@sbugallo/vpet-core/application/use-cases/get-sidebar-card-inputs.ts"
import type { EvolutionBattleRepository } from "@sbugallo/vpet-core/application/use-cases/resolve-evolution-battle.ts"
import type { ResolvedVpetSettings } from "@sbugallo/vpet-core/config/types.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { buildSidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"
import {
  MonsterAnimationController,
  type MonsterAnimationOutput,
} from "@sbugallo/vpet-animation/idle/monster-animation.ts"
import { runEvolutionBattleSession } from "@sbugallo/vpet-animation/sessions/evolution-battle-session.ts"
import { runEvolutionRevealSession } from "@sbugallo/vpet-animation/sessions/evolution-reveal-session.ts"

import { formatVpetToast, type VpetToastEvent, type VpetToastNotifier } from "./adapters/opencode/vpet-toast.ts"
import { createSqliteSidebarSnapshotReader } from "./adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteVpetArchiveReader } from "./adapters/sqlite/sqlite-vpet-archive-reader.ts"
import { createSqliteVpetRepository } from "./adapters/sqlite/sqlite-vpet-write-store.ts"
import { loadGlobalVpetSettings } from "./config/global-vpet-settings.ts"
import { createSidebarPollLoop } from "./tui/sidebar-poll-loop.ts"
import { VpetSidebarCard } from "./tui/sidebar-card.tsx"
import { registerVpetCommandLayer } from "./tui/vpet-command-layer.tsx"

const VISUAL_INTERVAL_MS = 500
const DEFAULT_BATTLE_ARTWORK_WIDTH = 80

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
  readonly battleRepository?: EvolutionBattleRepository
  readonly getSnapshot?: () => SidebarSnapshot | null
  readonly notify?: VpetToastNotifier
  readonly closeBattleRepository?: () => Promise<void>
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
    const [customArtwork, setCustomArtwork] = createSignal<string | undefined>()
    const controller = new MonsterAnimationController(
      MONSTER_FRAME_CATALOG,
      scheduling.random ?? Math.random,
      scheduling.nowMs,
    )
    let disposed = false
    let battleInProgress = false
    let lastPresentedNodeId: string | undefined
    let artworkWidth = DEFAULT_BATTLE_ARTWORK_WIDTH
    const notifyEvent = async (event: VpetToastEvent): Promise<void> => {
      if (scheduling.notify === undefined) return
      const payload = formatVpetToast(event, settings.language, DIGIMON_CATALOG)
      if (payload !== undefined) await scheduling.notify(payload)
    }
    const tryResolveEvolutionBattle = async (): Promise<boolean> => {
      if (
        disposed ||
        battleInProgress ||
        scheduling.battleRepository === undefined ||
        scheduling.getSnapshot === undefined
      ) {
        return false
      }
      const snapshot = scheduling.getSnapshot()
      if (snapshot === null) return false
      if (snapshot.pendingEvolutionTargetId === null || snapshot.battleOpponentNodeId === null) return false

      battleInProgress = true
      try {
        const battled = await runEvolutionBattleSession(snapshot, artworkWidth, {
          frameCatalog: MONSTER_FRAME_CATALOG,
          digimonCatalog: DIGIMON_CATALOG,
          repository: scheduling.battleRepository,
          ...(scheduling.random === undefined ? {} : { random: scheduling.random }),
          onArtwork: async (artwork) => {
            setCustomArtwork(artwork)
            api.renderer.requestRender()
          },
          onResolved: async (result) => {
            if (result.kind === "won") {
              await notifyEvent({ kind: "evolution", ...result.evolution })
            } else if (result.kind === "lost") {
              await notifyEvent({ kind: "defeat" })
            }
          },
        })
        if (battled) {
          setCustomArtwork(undefined)
          const nextInputs = await Promise.resolve().then(() => loadInputs())
          if (nextInputs.kind === "partner") lastPresentedNodeId = nextInputs.node.id
          setInputs(nextInputs)
          syncAnimation(nextInputs)
          api.renderer.requestRender()
        }
        return battled
      } finally {
        battleInProgress = false
        setCustomArtwork(undefined)
      }
    }
    const tryPlayEvolutionReveal = async (nextInputs: SidebarCardInputs): Promise<boolean> => {
      if (disposed || battleInProgress) return false
      if (nextInputs.kind !== "partner" || nextInputs.evolutionBattlePending) return false
      if (lastPresentedNodeId === undefined) {
        lastPresentedNodeId = nextInputs.node.id
        return false
      }
      if (lastPresentedNodeId === nextInputs.node.id) return false

      const evolution = { fromNodeId: lastPresentedNodeId, toNodeId: nextInputs.node.id }
      battleInProgress = true
      try {
        const revealed = await runEvolutionRevealSession(evolution, artworkWidth, {
          frameCatalog: MONSTER_FRAME_CATALOG,
          digimonCatalog: DIGIMON_CATALOG,
          onArtwork: async (artwork) => {
            setCustomArtwork(artwork)
            api.renderer.requestRender()
          },
        })
        if (!revealed) return false
        lastPresentedNodeId = nextInputs.node.id
        setCustomArtwork(undefined)
        setInputs(nextInputs)
        syncAnimation(nextInputs)
        api.renderer.requestRender()
        return true
      } finally {
        battleInProgress = false
        setCustomArtwork(undefined)
      }
    }
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
        void (async () => {
          if (await tryResolveEvolutionBattle()) {
            if (disposed) return
            poller.refresh()
            return
          }
          if (await tryPlayEvolutionReveal(nextInputs)) {
            if (disposed) return
            poller.refresh()
            return
          }
          if (disposed || battleInProgress) return
          if (nextInputs.kind === "partner") lastPresentedNodeId = nextInputs.node.id
          setInputs(nextInputs)
          syncAnimation(nextInputs)
          api.renderer.requestRender()
        })()
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
      if (disposed || battleInProgress) return
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
      void scheduling.closeBattleRepository?.()
    })

    api.slots.register({
      slots: {
        sidebar_content() {
          return (
            <VpetSidebarCard
              model={() => buildSidebarCardModel(inputs(), settings)}
              animation={animation}
              customArtwork={customArtwork}
              onArtworkWidthChange={(width) => {
                if (disposed) return
                artworkWidth = width
                if (publish(controller.dispatch({ kind: "viewport_resized", width }))) api.renderer.requestRender()
              }}
            />
          )
        },
      },
    })
  }

export const tui: TuiPlugin = async (api, options) => {
  const databaseOptions = readerOptions(options)
  const reader = createSqliteSidebarSnapshotReader(databaseOptions)
  const battleRepository = await createSqliteVpetRepository(databaseOptions)
  const archiveReader = createSqliteVpetArchiveReader(databaseOptions)
  const settings = await loadGlobalVpetSettings()
  await createTui(() => getSidebarCardInputs(reader, DIGIMON_CATALOG), settings, {
    archiveReader,
    battleRepository,
    getSnapshot: () => reader.getSidebarSnapshot(),
    ...("client" in api && api.client !== undefined && "tui" in api.client
      ? {
          notify: async (payload): Promise<void> => {
            void api.client.tui.showToast({
              title: payload.title,
              message: payload.message,
              variant: payload.variant,
              duration: payload.duration,
            })
          },
        }
      : {}),
    closeBattleRepository: () => battleRepository.close(),
  })({
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
