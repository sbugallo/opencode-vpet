export const DIGIMON_STAGES = [0, 1, 2, 3, 4, 5, 6, 7] as const

export type DigimonStage = (typeof DIGIMON_STAGES)[number]

export const isDigimonStage = (value: number): value is DigimonStage => {
  return DIGIMON_STAGES.some((stage) => stage === value)
}
