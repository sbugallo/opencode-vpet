/** @jsxImportSource @opentui/solid */
import { createTextAttributes, type BoxRenderable, type TextRenderable } from "@opentui/core"
import { createEffect, type Accessor } from "solid-js"
import { openInBrowser } from "./open-in-browser.ts"
import { mirrorMonsterFrame } from "./monster-artwork-mirror.ts"
import type { MonsterAnimationOutput, MonsterAnimationResult } from "./monster-animation.ts"
import type { SidebarCardModel } from "./sidebar-view-model.ts"

const ARTWORK_ROWS = 8
const ARTWORK_COLUMNS = 16
const NEXT_CHECK_PREFIX = "Next check: "
const URL_LABEL = "Encyclopedia entry"
const LINK_ATTRIBUTES = createTextAttributes({ underline: true })
const LINK_COLOR = "#5f87ff"

const formatCount = (value: number): string => value.toLocaleString("en-US")

const positionedOutput = (animation: MonsterAnimationOutput | MonsterAnimationResult): MonsterAnimationOutput => {
  if ("result" in animation) return animation
  switch (animation.kind) {
    case "blank":
      return { kind: "blank", result: animation, offset: 0, facing: "left" }
    case "frame":
      return { kind: "walking", result: animation, offset: 0, facing: "left" }
    case "unavailable":
      return { kind: "unavailable", result: animation, offset: 0, facing: "left" }
  }
}

const artworkRows = (animation: MonsterAnimationOutput | MonsterAnimationResult, width: number): readonly string[] => {
  const output = positionedOutput(animation)
  switch (output.result.kind) {
    case "blank":
      return Array.from({ length: ARTWORK_ROWS }, () => "")
    case "frame": {
      const mirrored = output.facing === "right" ? mirrorMonsterFrame(output.result.frame) : undefined
      if (mirrored?.kind === "invalid") return Array.from({ length: ARTWORK_ROWS }, () => "")
      const content = mirrored?.frame.content ?? output.result.frame.content
      const free = Math.max(width - ARTWORK_COLUMNS, 0)
      const left = Math.max(0, Math.min(free, Math.floor(free / 2) + output.offset))
      return content.split("\n").map((row) => `${" ".repeat(left)}${row}`)
    }
    case "unavailable": {
      const key = output.result.sprite === "" ? "(empty)" : output.result.sprite
      const content = `Artwork unavailable: ${key}`
      return Array.from({ length: ARTWORK_ROWS }, (_, index) =>
        index === 3 ? `${" ".repeat(Math.max(Math.floor((width - content.length) / 2), 0))}${content}` : "",
      )
    }
  }
}

const buildNextCheckLine = (model: SidebarCardModel, width: number): string => {
  if (model.kind === "no_partner") return ""
  if (model.isTerminal && !model.isSetOverride) return `${NEXT_CHECK_PREFIX}None`

  const barWidth = Math.max(width - NEXT_CHECK_PREFIX.length - 2, 0)
  const progress = model.isTerminal ? 1 : Math.min(Math.max(model.gauge / model.threshold, 0), 1)
  const filled = Math.floor(progress * barWidth)
  return `${NEXT_CHECK_PREFIX}[${"█".repeat(filled)}${"░".repeat(barWidth - filled)}]`
}

export const VpetSidebarCard = (props: {
  readonly model: Accessor<SidebarCardModel>
  readonly animation: Accessor<MonsterAnimationOutput | MonsterAnimationResult>
  readonly onArtworkWidthChange?: (width: number) => void
  readonly onUrlClick?: (url: string) => void
}) => {
  const artwork: (TextRenderable | undefined)[] = Array.from({ length: ARTWORK_ROWS })
  let name: TextRenderable | undefined
  let stage: TextRenderable | undefined
  let nextCheck: TextRenderable | undefined
  let gauge: TextRenderable | undefined
  let url: TextRenderable | undefined
  let artworkWidth: BoxRenderable | undefined
  let nextCheckWidth: BoxRenderable | undefined
  let reportedArtworkWidth: number | undefined

  const updateText = (renderable: TextRenderable | undefined, content: string): void => {
    if (renderable === undefined) return
    renderable.content = content
    renderable.requestRender()
  }

  const handleUrlClick = (): void => {
    const model = props.model()
    if (model.kind !== "partner") return
    ;(props.onUrlClick ?? openInBrowser)(model.url)
  }

  const renderCard = (): void => {
    const model = props.model()
    for (const [index, content] of artworkRows(props.animation(), Math.floor(artworkWidth?.width ?? 0)).entries()) {
      updateText(artwork[index], content)
    }

    switch (model.kind) {
      case "no_partner":
        updateText(name, model.messageLine)
        updateText(stage, "")
        updateText(nextCheck, "")
        updateText(gauge, "")
        updateText(url, "")
        return
      case "partner":
        updateText(name, model.isSetOverride ? `${model.name} (set)` : model.name)
        updateText(stage, model.frozen ? `${model.stage} (frozen)` : model.stage)
        updateText(nextCheck, buildNextCheckLine(model, nextCheckWidth?.width ?? 0))
        updateText(gauge, model.isTerminal ? "-/-" : `${formatCount(model.gauge)}/${formatCount(model.threshold)}`)
        updateText(url, URL_LABEL)
        return
    }
  }

  createEffect(renderCard)

  const reportArtworkWidth = (): void => {
    const width = Math.floor(artworkWidth?.width ?? 0)
    if (width === reportedArtworkWidth) return
    reportedArtworkWidth = width
    props.onArtworkWidthChange?.(width)
    renderCard()
  }

  return (
    <box width="100%" border={["top", "bottom"]} borderStyle="single" flexDirection="column">
      <box
        width="100%"
        height={ARTWORK_ROWS}
        flexDirection="column"
        onSizeChange={reportArtworkWidth}
        ref={(renderable) => {
          artworkWidth = renderable
          renderCard()
        }}
      >
        {Array.from({ length: ARTWORK_ROWS }, (_, index) => (
          <text
            ref={(renderable) => {
              artwork[index] = renderable
              renderCard()
            }}
          />
        ))}
      </box>
      <text
        wrapMode="none"
        truncate
        ref={(renderable) => {
          name = renderable
          renderCard()
        }}
      />
      <text
        wrapMode="none"
        truncate
        ref={(renderable) => {
          stage = renderable
          renderCard()
        }}
      />
      <box
        width="100%"
        onSizeChange={() => renderCard()}
        ref={(renderable) => {
          nextCheckWidth = renderable
          renderCard()
        }}
      >
        <text
          ref={(renderable) => {
            nextCheck = renderable
            renderCard()
          }}
        />
      </box>
      <text
        ref={(renderable) => {
          gauge = renderable
          renderCard()
        }}
      />
      <text
        wrapMode="none"
        truncate
        fg={LINK_COLOR}
        attributes={LINK_ATTRIBUTES}
        onMouseDown={handleUrlClick}
        ref={(renderable) => {
          url = renderable
          renderCard()
        }}
      />
    </box>
  )
}
