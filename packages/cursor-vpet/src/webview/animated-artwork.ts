import { mirrorMonsterFrame } from "./monster-artwork-mirror.ts"
import type { MonsterAnimationOutput, MonsterAnimationResult } from "./monster-animation.ts"

const ARTWORK_ROWS = 8
const ARTWORK_COLUMNS = 16

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

export const renderPositionedArtwork = (
  animation: MonsterAnimationOutput | MonsterAnimationResult,
  viewportWidth: number,
): string => {
  const output = positionedOutput(animation)
  switch (output.result.kind) {
    case "blank":
      return ""
    case "frame": {
      const mirrored = output.facing === "right" ? mirrorMonsterFrame(output.result.frame) : undefined
      if (mirrored?.kind === "invalid") return ""
      const content = mirrored?.frame.content ?? output.result.frame.content
      const free = Math.max(viewportWidth - ARTWORK_COLUMNS, 0)
      const left = Math.max(0, Math.min(free, Math.floor(free / 2) + output.offset))
      return content
        .split("\n")
        .map((row) => `${" ".repeat(left)}${row}`)
        .join("\n")
    }
    case "unavailable": {
      const key = output.result.sprite === "" ? "(empty)" : output.result.sprite
      const message = `Artwork unavailable: ${key}`
      const padding = Math.max(Math.floor((viewportWidth - message.length) / 2), 0)
      return Array.from({ length: ARTWORK_ROWS }, (_, index) =>
        index === 3 ? `${" ".repeat(padding)}${message}` : "",
      ).join("\n")
    }
  }
}
