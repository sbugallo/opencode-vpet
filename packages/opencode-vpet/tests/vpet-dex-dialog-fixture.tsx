/** @jsxImportSource @opentui/solid */
import { mock } from "bun:test"
import type { VpetDexDialogTheme } from "../src/tui/vpet-dex-dialog.tsx"
import type { TuiDialogProps } from "@opencode-ai/plugin/tui"
import { parseColor } from "@opentui/core"
import type { JSX } from "solid-js"

export const createMockTheme = (): VpetDexDialogTheme => ({
  current: {
    success: parseColor("#00ff00"),
    textMuted: parseColor("#888888"),
    primary: parseColor("#0000ff"),
  },
})

export const createTrackedDialogApi = () => {
  const Dialog = mock(
    (props: TuiDialogProps): JSX.Element => (
      <box flexDirection="column" width="100%" height="100%">
        {props.children}
      </box>
    ),
  )
  return {
    theme: createMockTheme(),
    Dialog,
  }
}
