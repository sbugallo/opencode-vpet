import { MonsterFrame } from "../data/monster-frame-catalog.ts"

const FRAME_ROWS = 8
const FRAME_COLUMNS = 16

export type MalformedMonsterFrameReason =
  | { readonly kind: "row_count"; readonly actual: number }
  | { readonly kind: "column_count"; readonly row: number; readonly actual: number }

export class MalformedMonsterFrameError extends Error {
  readonly name = "MalformedMonsterFrameError"

  constructor(readonly reason: MalformedMonsterFrameReason) {
    super("Monster frame must contain eight rows of 16 Unicode code points")
  }
}

export type MirrorMonsterFrameResult =
  | { readonly kind: "mirrored"; readonly frame: MonsterFrame }
  | { readonly kind: "invalid"; readonly error: MalformedMonsterFrameError }

const mirrorGlyph = (glyph: string): string => {
  switch (glyph) {
    case "(":
      return ")"
    case ")":
      return "("
    case "[":
      return "]"
    case "]":
      return "["
    case "{":
      return "}"
    case "}":
      return "{"
    case "<":
      return ">"
    case ">":
      return "<"
    case "╱":
      return "╲"
    case "╲":
      return "╱"
    case "╭":
      return "╮"
    case "╮":
      return "╭"
    case "╰":
      return "╯"
    case "╯":
      return "╰"
    default:
      return glyph
  }
}

export const mirrorMonsterFrame = (frame: MonsterFrame): MirrorMonsterFrameResult => {
  const rows = frame.content.split("\n")
  if (rows.length !== FRAME_ROWS) {
    return { kind: "invalid", error: new MalformedMonsterFrameError({ kind: "row_count", actual: rows.length }) }
  }

  for (const [row, content] of rows.entries()) {
    const cells = Array.from(content)
    if (cells.length !== FRAME_COLUMNS) {
      return {
        kind: "invalid",
        error: new MalformedMonsterFrameError({ kind: "column_count", row, actual: cells.length }),
      }
    }
  }

  return Object.freeze({
    kind: "mirrored",
    frame: new MonsterFrame(rows.map((row) => Array.from(row).reverse().map(mirrorGlyph).join("")).join("\n")),
  })
}
