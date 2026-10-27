export const DIGIMON_STAGES = Object.freeze([
  "digitama",
  "babyI",
  "babyII",
  "child",
  "adult",
  "perfect",
  "ultimate",
  "superUltimate",
  "hybrid",
  "armor",
  "unknown",
] as const)

export type DigimonStage = (typeof DIGIMON_STAGES)[number]

export const isDigimonStage = (value: string): value is DigimonStage => {
  return DIGIMON_STAGES.some((stage) => stage === value)
}
