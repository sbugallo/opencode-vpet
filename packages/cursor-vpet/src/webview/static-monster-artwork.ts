import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"

const STATIC_FRAME_NAMES = ["happy", "walk_1", "sleep_1"] as const

export const resolveStaticMonsterArtwork = (sprite: string): string => {
  for (const frameName of STATIC_FRAME_NAMES) {
    const frame = MONSTER_FRAME_CATALOG.get(sprite, frameName)
    if (frame !== undefined) return frame.content
  }
  return sprite.length === 0 ? "" : `Artwork unavailable: ${sprite}`
}
