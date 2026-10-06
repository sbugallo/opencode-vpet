import type { DigimonStage } from "./stage.ts"

export type DigimonNode = {
  readonly id: string
  readonly nameEn: string
  readonly nameJp: string
  readonly nextEvolutions: readonly string[]
  readonly sprite: string
  readonly stage: DigimonStage
  readonly url: string
}

export type DigimonCatalog = {
  readonly nodes: readonly DigimonNode[]
  readonly byId: ReadonlyMap<string, DigimonNode>
}
