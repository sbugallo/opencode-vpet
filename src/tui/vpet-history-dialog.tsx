/** @jsxImportSource @opentui/solid */
import { createTextAttributes, type KeyEvent, type ScrollBoxRenderable } from "@opentui/core"
import { For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { TuiTheme } from "@opencode-ai/plugin/tui"
import type { HistoryViewModel } from "./history-view-model.ts"

export type VpetHistoryDialogTheme = {
  readonly current: Pick<TuiTheme["current"], "primary">
}

export type VpetHistoryDialogProps = {
  readonly theme: VpetHistoryDialogTheme
  readonly model: HistoryViewModel
  readonly onClose: () => void
}

const BOLD = createTextAttributes({ bold: true })

export function VpetHistoryDialog(props: VpetHistoryDialogProps) {
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
        VPet History
      </text>
      <box flexDirection="column" width="100%" height={height - 2} flexShrink={0} overflow="hidden">
        {props.model.kind === "empty" && <text>No data available</text>}
        {props.model.kind === "unavailable" && <text>{props.model.message}</text>}
        {props.model.kind === "available" && (
          <scrollbox
            id="vpet-history-scrollbox"
            ref={(renderable) => {
              scrollbox = renderable
            }}
            focused={true}
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
            <For each={props.model.generations}>
              {(generation) => {
                const status = generation.retiredAt === null ? "Active" : "Retired"
                const header = `Generation ${generation.generation} — ${generation.createdAt} — ${status}`
                const pathText =
                  generation.path.length === 0 ? "No canonical events recorded" : generation.path.join(" → ")

                return (
                  <box flexDirection="column" width="100%" paddingBottom={1}>
                    <text attributes={BOLD} fg={props.theme.current.primary}>
                      {header}
                    </text>
                    <box width="100%" flexDirection="row">
                      <text wrapMode="word">{pathText}</text>
                    </box>
                  </box>
                )
              }}
            </For>
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
