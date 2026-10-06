export const OPENCODE_DEV_ACTIONS = [
  { id: "feed", title: "Digital Pet Dev Feed", slashName: "digital-pet-dev-feed" },
  { id: "activity", title: "Digital Pet Dev Activity", slashName: "digital-pet-dev-activity" },
  { id: "evolution_reveal", title: "Digital Pet Dev Evolution Reveal", slashName: "digital-pet-dev-evolution-reveal" },
  { id: "evolution_battle", title: "Digital Pet Dev Evolution Battle", slashName: "digital-pet-dev-evolution-battle" },
  { id: "defeat", title: "Digital Pet Dev Defeat (via battle)", slashName: "digital-pet-dev-defeat" },
] as const

export type OpencodeDevActionId = (typeof OPENCODE_DEV_ACTIONS)[number]["id"]
