import { inflateSync } from "node:zlib"

import { MONSTER_COLOR_FRAME_DATA } from "./monster-color-frames.ts"

export const MONSTER_FRAME_WIDTH = 16
export const MONSTER_FRAME_HEIGHT = 16

const FRAME_PIXELS = MONSTER_FRAME_WIDTH * MONSTER_FRAME_HEIGHT

export const MONSTER_FRAME_NAMES = [
  "angry",
  "attack_1",
  "attack_2",
  "eat_1",
  "eat_2",
  "happy",
  "refuse",
  "sick",
  "sleep_1",
  "sleep_2",
  "walk_1",
  "walk_2",
] as const

export type MonsterFrameName = (typeof MONSTER_FRAME_NAMES)[number]

export const STANDARD_MONSTER_FRAME_NAMES = ["walk_1", "walk_2"] as const

export type StandardMonsterFrameName = (typeof STANDARD_MONSTER_FRAME_NAMES)[number]

export const STANDARD_ANIMATION_SEQUENCE: readonly MonsterFrameName[] = MONSTER_FRAME_NAMES.filter(
  (frameName) => frameName !== "refuse",
)

export const isMonsterFrameName = (value: string): value is MonsterFrameName =>
  MONSTER_FRAME_NAMES.some((frameName) => frameName === value)

/** A 16x16 RGBA sprite frame reduced to palette indices; index 0 is transparent. */
export type MonsterFrame = {
  /** 256 row-major palette indices; 0 marks a transparent pixel. */
  readonly pixels: Uint8Array
  /** Index 0 is always `null` (transparent); positive indices address RGB hex colors. */
  readonly palette: readonly (string | null)[]
}

export type MonsterFrames = {
  readonly sprite: string
  readonly frames: Readonly<Partial<Record<MonsterFrameName, MonsterFrame>>>
}

export const createMonsterFrame = (pixels: Uint8Array, palette: readonly (string | null)[]): MonsterFrame => {
  if (pixels.length !== FRAME_PIXELS) {
    throw new Error(`Monster frame must hold ${FRAME_PIXELS} pixels, found ${pixels.length}.`)
  }
  return Object.freeze({ pixels, palette })
}

export const createMonsterFrames = (
  sprite: string,
  frames: Readonly<Partial<Record<MonsterFrameName, MonsterFrame>>>,
): MonsterFrames => Object.freeze({ sprite, frames: Object.freeze({ ...frames }) })

const toHexByte = (byte: number | undefined): string => (byte ?? 0).toString(16).padStart(2, "0")

/**
 * Decodes one generated sprite blob: u16be color count, then that many RGB
 * triplets (index 1 onward; index 0 is transparent), then 256 palette-index
 * bytes per pose in the given pose order.
 */
export const decodeMonsterSprite = (sprite: string, poses: readonly string[], blob: string): MonsterFrames => {
  const raw = inflateSync(Buffer.from(blob, "base64"))
  const colorCount = raw.readUInt16BE(0)
  const palette: (string | null)[] = [null]
  for (let index = 0; index < colorCount; index += 1) {
    const at = 2 + index * 3
    palette.push(`#${toHexByte(raw[at])}${toHexByte(raw[at + 1])}${toHexByte(raw[at + 2])}`)
  }

  const frames: Partial<Record<MonsterFrameName, MonsterFrame>> = {}
  const pixelOffset = 2 + colorCount * 3
  for (const [index, pose] of poses.entries()) {
    if (!isMonsterFrameName(pose)) throw new Error(`Sprite ${sprite} ships unknown frame ${JSON.stringify(pose)}.`)
    const start = pixelOffset + index * FRAME_PIXELS
    frames[pose] = createMonsterFrame(raw.subarray(start, start + FRAME_PIXELS).slice(), palette)
  }
  return createMonsterFrames(sprite, frames)
}

/** Map that inflates sprite blobs on first access and memoizes the result. */
class LazySpriteMap extends Map<string, MonsterFrames> {
  readonly #encoded: ReadonlyMap<string, readonly [poses: readonly string[], blob: string]>

  constructor(encoded: ReadonlyMap<string, readonly [poses: readonly string[], blob: string]>) {
    super()
    this.#encoded = encoded
  }

  override get(sprite: string): MonsterFrames | undefined {
    const cached = super.get(sprite)
    if (cached !== undefined) return cached
    const entry = this.#encoded.get(sprite)
    if (entry === undefined) return undefined
    const decoded = decodeMonsterSprite(sprite, entry[0], entry[1])
    super.set(sprite, decoded)
    return decoded
  }
}

export class MonsterFrameCatalog {
  readonly #sprites: ReadonlyMap<string, MonsterFrames>

  constructor(sprites: ReadonlyMap<string, MonsterFrames>) {
    this.#sprites = sprites
  }

  get(sprite: string, name: MonsterFrameName): MonsterFrame | undefined {
    return this.#sprites.get(sprite)?.frames[name]
  }

  frames(sprite: string): MonsterFrames | undefined {
    return this.#sprites.get(sprite)
  }
}

export const MONSTER_FRAME_CATALOG = new MonsterFrameCatalog(
  new LazySpriteMap(new Map(MONSTER_COLOR_FRAME_DATA.map(([sprite, poses, blob]) => [sprite, [poses, blob] as const]))),
)
