/** @jsxImportSource @opentui/solid */
import { describe, expect, mock, test } from "bun:test"
import { testRender, useTerminalDimensions } from "@opentui/solid"
import type { BoxRenderable } from "@opentui/core"
import type { JSX } from "solid-js"
import { VpetDexDialog } from "../src/tui/vpet-dex-dialog.tsx"
import { VpetHistoryDialog } from "../src/tui/vpet-history-dialog.tsx"
import { createMockTheme } from "./vpet-dex-dialog-fixture.tsx"

type DialogLayoutCase = {
  readonly name: string
  readonly render: () => JSX.Element
}

const layoutCases: DialogLayoutCase[] = [
  {
    name: "Dex",
    render: () => <VpetDexDialog theme={createMockTheme()} model={{ kind: "empty" }} onClose={mock()} />,
  },
  {
    name: "history",
    render: () => <VpetHistoryDialog theme={createMockTheme()} model={{ kind: "empty" }} onClose={mock()} />,
  },
]

describe("VPet dialog layout", () => {
  test.each(layoutCases)(
    "Given the OpenCode host Dialog When it renders a %s replacement body Then the host-owned surface is centered in the viewport",
    async ({ render }) => {
      let surface: BoxRenderable | undefined
      const setup = await testRender(
        () => {
          const dimensions = useTerminalDimensions()
          return (
            <box
              width={dimensions().width}
              height={dimensions().height}
              alignItems="center"
              position="absolute"
              paddingTop={dimensions().height / 4}
              left={0}
              top={0}
            >
              <box
                ref={(value: BoxRenderable) => {
                  surface = value
                }}
                width={60}
                maxWidth={dimensions().width - 2}
                paddingTop={1}
              >
                {render()}
              </box>
            </box>
          )
        },
        { width: 80, height: 24 },
      )
      await setup.flush()

      if (surface === undefined) throw new Error("Expected OpenCode host dialog surface")
      expect(surface.height).toBe(12)

      setup.renderer.destroy()
    },
  )
})
