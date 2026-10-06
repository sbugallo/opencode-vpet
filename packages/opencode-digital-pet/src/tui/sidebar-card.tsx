/** @jsxImportSource @opentui/solid */
import { createTextAttributes, type BoxRenderable, type TextRenderable } from "@opentui/core"
import { createEffect, type Accessor } from "solid-js"

import type { SidebarCardModel } from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"
import { MONSTER_FRAME_ROWS } from "@jcendal/digital-pet-animation/constants/monster-artwork.ts"
import type {
  MonsterAnimationOutput,
  MonsterAnimationResult,
} from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtworkRows } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"

import { openInBrowser } from "./open-in-browser.ts"

const ARTWORK_ROWS = MONSTER_FRAME_ROWS
const NEXT_CHECK_PREFIX = "Next check: "
const URL_LABEL = "Encyclopedia entry"
const LINK_ATTRIBUTES = createTextAttributes({ underline: true })
const LINK_COLOR = "#5f87ff"

const formatCount = (value: number): string => value.toLocaleString("en-US")

const customArtworkRows = (artwork: string): readonly string[] => {
  const rows = artwork.split("\n")
  if (rows.length >= ARTWORK_ROWS) return rows.slice(0, ARTWORK_ROWS)
  return [...rows, ...Array.from({ length: ARTWORK_ROWS - rows.length }, () => "")]
}

const buildNextCheckLine = (model: SidebarCardModel, width: number): string => {
  if (model.kind === "no_partner") return ""
  if (model.evolutionBattlePending) return `${NEXT_CHECK_PREFIX}Evolution battle!`
  if (model.isTerminal && !model.isSetOverride) return `${NEXT_CHECK_PREFIX}None`

  const barWidth = Math.max(width - NEXT_CHECK_PREFIX.length - 2, 0)
  const progress = model.isTerminal ? 1 : Math.min(Math.max(model.gauge / model.threshold, 0), 1)
  const filled = Math.floor(progress * barWidth)
  return `${NEXT_CHECK_PREFIX}[${"█".repeat(filled)}${"░".repeat(barWidth - filled)}]`
}

export const DigitalPetSidebarCard = (props: {
  readonly model: Accessor<SidebarCardModel>
  readonly animation: Accessor<MonsterAnimationOutput | MonsterAnimationResult>
  readonly customArtwork?: Accessor<string | undefined>
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
    const width = Math.floor(artworkWidth?.width ?? 0)
    const battleArtwork = props.customArtwork?.()
    const rows =
      battleArtwork === undefined
        ? renderPositionedArtworkRows(props.animation(), width)
        : customArtworkRows(battleArtwork)
    for (const [index, content] of rows.entries()) {
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
