/** @jsxImportSource @opentui/solid */
import { createTextAttributes, type KeyEvent, type ScrollBoxRenderable } from "@opentui/core"
import { For, createMemo } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { TuiTheme } from "@opencode-ai/plugin/tui"
import type { DexRow, DexViewModel } from "./dex-view-model.ts"

export type VpetDexDialogTheme = {
  readonly current: Pick<TuiTheme["current"], "primary" | "success" | "textMuted">
}

export type VpetDexDialogProps = {
  readonly theme: VpetDexDialogTheme
  readonly model: DexViewModel
  readonly onClose: () => void
}

const BOLD = createTextAttributes({ bold: true })

export function VpetDexDialog(props: VpetDexDialogProps) {
  const dimensions = useTerminalDimensions()
  const height = Math.max(10, Math.floor(dimensions().height / 2) - 1)
  let scrollbox: ScrollBoxRenderable | undefined

  useKeyboard((event: KeyEvent) => {
    if (event.name === "escape") {
      props.onClose()
      return
    }

    const delta = arrowDelta(event.name)
    if (delta === undefined || scrollbox === undefined) return
    event.preventDefault()
    event.stopPropagation()
    scrollbox.scrollBy(delta, "absolute")
  })

  return (
    <box flexDirection="column" width="100%" height={height} paddingX={1}>
      <text attributes={BOLD} fg={props.theme.current.primary} flexShrink={0}>
        VPet Dex
      </text>
      <box flexDirection="column" width="100%" height={height - 2} flexShrink={0} overflow="hidden">
        {props.model.kind === "empty" && <text>No data available</text>}
        {props.model.kind === "unavailable" && <text>{props.model.message}</text>}
        {props.model.kind === "available" && (
          <scrollbox
            id="vpet-dex-scrollbox"
            ref={(renderable) => {
              scrollbox = renderable
            }}
            width="100%"
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            scrollX={false}
            scrollY={true}
            wrapperOptions={{ flexDirection: "column", flexGrow: 1, flexShrink: 1, minHeight: 0 }}
            viewportOptions={{ flexDirection: "column", flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: "hidden" }}
            contentOptions={{ flexDirection: "column" }}
            verticalScrollbarOptions={{ width: 1 }}
          >
            <DexList model={props.model} theme={props.theme} />
          </scrollbox>
        )}
      </box>
      <text flexShrink={0} onMouseDown={props.onClose}>
        ↑↓: 1 item · ←→: 10 items · Esc: Close
      </text>
    </box>
  )
}

const arrowDelta = (name: string): number | undefined => {
  switch (name) {
    case "up":
      return -1
    case "down":
      return 1
    case "left":
      return -10
    case "right":
      return 10
    default:
      return undefined
  }
}

function DexList(props: {
  readonly model: Extract<DexViewModel, { readonly kind: "available" }>
  readonly theme: VpetDexDialogTheme
}) {
  const groups = createMemo(() => {
    const byStage = new Map<string, DexRow[]>()
    for (const row of props.model.rows) {
      const rows = byStage.get(row.stage)
      if (rows === undefined) {
        byStage.set(row.stage, [row])
      } else {
        rows.push(row)
      }
    }
    return Array.from(byStage, ([stage, rows]) => ({ stage, rows }))
  })

  return (
    <box flexDirection="column" width="100%">
      <For each={groups()}>
        {({ stage, rows }) => (
          <box flexDirection="column" width="100%" paddingBottom={1}>
            <text attributes={BOLD} fg={props.theme.current.primary}>
              {stage}
            </text>
            <For each={rows}>
              {(row) => (
                <box flexDirection="row" width="100%">
                  <text fg={row.discovered ? props.theme.current.success : props.theme.current.textMuted}>● </text>
                  <text wrapMode="word">
                    {row.id} {row.name}
                  </text>
                </box>
              )}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}
