export const MONSTER_FRAME_NAMES = Object.freeze([
  "angry",
  "attack",
  "eat_1",
  "eat_2",
  "happy",
  "injured_1",
  "injured_2",
  "refuse",
  "sleep_1",
  "sleep_2",
  "walk_1",
  "walk_2",
] as const)

export type MonsterFrameName = (typeof MONSTER_FRAME_NAMES)[number]

export const STANDARD_ANIMATION_SEQUENCE = Object.freeze([
  "angry",
  "attack",
  "eat_1",
  "eat_2",
  "happy",
  "injured_1",
  "injured_2",
  "sleep_1",
  "sleep_2",
  "walk_1",
  "walk_2",
] as const)

type SpriteFrames = Iterable<readonly [MonsterFrameName, MonsterFrame]>
type CatalogFrames = Iterable<readonly [string, SpriteFrames]>

export class MonsterFrame {
  readonly content: string

  constructor(content: string) {
    this.content = content
    Object.freeze(this)
  }
}

export class MonsterFrameCatalog {
  readonly #frames: Map<string, Map<MonsterFrameName, MonsterFrame>>

  constructor(frames: CatalogFrames) {
    this.#frames = new Map(Array.from(frames, ([sprite, spriteFrames]) => [sprite, new Map(spriteFrames)]))
    Object.freeze(this)
  }

  get(sprite: string, frameName: MonsterFrameName): MonsterFrame | undefined {
    return this.#frames.get(sprite)?.get(frameName)
  }
}

export const MONSTER_FRAME_CATALOG = new MonsterFrameCatalog(
  MONSTER_FRAME_DATA.map(([sprite, frames]) => [
    sprite,
    frames.map(([frameName, content]) => [frameName, new MonsterFrame(content)]),
  ]),
)
import { MONSTER_FRAME_DATA } from "./monster-frame-data.ts"
