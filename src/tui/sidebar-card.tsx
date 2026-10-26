/** @jsxImportSource @opentui/solid */
import {
  createTextAttributes,
  type BoxRenderable,
  RGBA,
  StyledText,
  type TextChunk,
  type TextRenderable,
} from "@opentui/core"
import { createEffect, type Accessor } from "solid-js"
import { openInBrowser } from "./open-in-browser.ts"
import type { MonsterAnimationOutput, MonsterAnimationResult } from "./monster-animation.ts"
import { renderMonsterSprite, type MonsterSpriteRow } from "./monster-sprite-renderer.ts"
import type { SidebarCardModel } from "./sidebar-view-model.ts"
import type { VpetTheme } from "./theme.ts"

export type VpetSidebarCardTheme = {
  readonly current: Pick<VpetTheme["current"], "text" | "accent">
}

const ARTWORK_ROWS = 8
const ARTWORK_COLUMNS = 16
const NEXT_CHECK_PREFIX = "Next check: "
const URL_LABEL = "Encyclopedia entry"
const LINK_ATTRIBUTES = createTextAttributes({ underline: true })

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

const EMPTY_ARTWORK_ROWS: readonly string[] = Object.freeze(Array.from({ length: ARTWORK_ROWS }, () => ""))

const rgbaCache = new Map<string, RGBA>()

const hexToRgba = (hex: string): RGBA => {
  const cached = rgbaCache.get(hex)
  if (cached !== undefined) return cached
  const parsed = RGBA.fromHex(hex)
  rgbaCache.set(hex, parsed)
  return parsed
}

const styledArtworkRow = (row: MonsterSpriteRow, indent: number): StyledText => {
  const chunks: TextChunk[] = []
  if (indent > 0) chunks.push({ __isChunk: true, text: " ".repeat(indent) })
  for (const run of row.runs) {
    chunks.push({
      __isChunk: true,
      text: row.text.slice(run.start, run.start + run.length),
      ...(run.fg === null ? {} : { fg: hexToRgba(run.fg) }),
      ...(run.bg === null ? {} : { bg: hexToRgba(run.bg) }),
    })
  }
  return new StyledText(chunks)
}

const artworkRows = (
  animation: MonsterAnimationOutput | MonsterAnimationResult,
  width: number,
): readonly (string | StyledText)[] => {
  const output = positionedOutput(animation)
  switch (output.result.kind) {
    case "blank":
      return EMPTY_ARTWORK_ROWS
    case "frame": {
      const sprite = renderMonsterSprite(output.result.frame, output.facing)
      const free = Math.max(width - ARTWORK_COLUMNS, 0)
      const left = Math.max(0, Math.min(free, Math.floor(free / 2) + output.offset))
      return sprite.map((row) => styledArtworkRow(row, left))
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
  /** Reads the current theme at render time so live host theme switches propagate. */
  readonly theme?: (() => VpetSidebarCardTheme) | undefined
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

  const updateText = (renderable: TextRenderable | undefined, content: string | StyledText, color?: RGBA): void => {
    if (renderable === undefined) return
    renderable.content = content
    if (color !== undefined) renderable.fg = color
    renderable.requestRender()
  }

  const handleUrlClick = (): void => {
    const model = props.model()
    if (model.kind !== "partner") return
    ;(props.onUrlClick ?? openInBrowser)(model.url)
  }

  const renderCard = (): void => {
    const model = props.model()
    const theme = props.theme?.()
    const textColor = theme?.current.text
    for (const [index, content] of artworkRows(props.animation(), Math.floor(artworkWidth?.width ?? 0)).entries()) {
      updateText(artwork[index], content, textColor)
    }

    switch (model.kind) {
      case "no_partner":
        updateText(name, model.messageLine, textColor)
        updateText(stage, "")
        updateText(nextCheck, "")
        updateText(gauge, "")
        updateText(url, "")
        return
      case "partner":
        updateText(name, model.isSetOverride ? `${model.name} (set)` : model.name, textColor)
        updateText(stage, model.frozen ? `${model.stage} (frozen)` : model.stage, textColor)
        updateText(nextCheck, buildNextCheckLine(model, nextCheckWidth?.width ?? 0), textColor)
        updateText(
          gauge,
          model.isTerminal ? "-/-" : `${formatCount(model.gauge)}/${formatCount(model.threshold)}`,
          textColor,
        )
        updateText(url, URL_LABEL, theme?.current.accent)
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
