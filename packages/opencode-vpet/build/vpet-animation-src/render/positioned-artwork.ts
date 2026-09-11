import { MONSTER_FRAME_COLUMNS, MONSTER_FRAME_ROWS } from "../constants/monster-artwork.ts"
import type { MonsterAnimationOutput, MonsterAnimationResult } from "../idle/monster-animation.ts"
import { mirrorMonsterFrame } from "../idle/monster-artwork-mirror.ts"

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

export const renderPositionedArtworkRows = (
  animation: MonsterAnimationOutput | MonsterAnimationResult,
  viewportWidth: number,
): readonly string[] => {
  const output = positionedOutput(animation)
  switch (output.result.kind) {
    case "blank":
      return Array.from({ length: MONSTER_FRAME_ROWS }, () => "")
    case "frame": {
      const mirrored = output.facing === "right" ? mirrorMonsterFrame(output.result.frame) : undefined
      if (mirrored?.kind === "invalid") return Array.from({ length: MONSTER_FRAME_ROWS }, () => "")
      const content = mirrored?.frame.content ?? output.result.frame.content
      const free = Math.max(viewportWidth - MONSTER_FRAME_COLUMNS, 0)
      const left = Math.max(0, Math.min(free, Math.floor(free / 2) + output.offset))
      return content.split("\n").map((row) => `${" ".repeat(left)}${row}`)
    }
    case "unavailable": {
      const key = output.result.sprite === "" ? "(empty)" : output.result.sprite
      const message = `Artwork unavailable: ${key}`
      const padding = Math.max(Math.floor((viewportWidth - message.length) / 2), 0)
      return Array.from({ length: MONSTER_FRAME_ROWS }, (_, index) =>
        index === 3 ? `${" ".repeat(padding)}${message}` : "",
      )
    }
  }
}

export const renderPositionedArtwork = (
  animation: MonsterAnimationOutput | MonsterAnimationResult,
  viewportWidth: number,
): string => renderPositionedArtworkRows(animation, viewportWidth).join("\n")
