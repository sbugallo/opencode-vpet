import { DIGIMON_DATA } from "./digimon-data.ts"
import { isDigimonStage } from "../domain/stage.ts"
import type { DigimonCatalog, DigimonNode } from "../domain/digimon-node.ts"

export type { DigimonCatalog, DigimonNode } from "../domain/digimon-node.ts"

export type RawDigimonNode = {
  readonly id: string
  readonly name_en: string
  readonly name_jp: string
  readonly next_evolutions: readonly string[]
  readonly sprite: string
  readonly stage: number
  readonly url: string
}

const parseNode = (input: RawDigimonNode): DigimonNode => {
  if (!isDigimonStage(input.stage)) throw new Error(`Invalid stage ${input.stage} for ${input.id}`)

  return Object.freeze({
    id: input.id,
    nameEn: input.name_en,
    nameJp: input.name_jp,
    nextEvolutions: Object.freeze([...input.next_evolutions]),
    sprite: input.sprite,
    stage: input.stage,
    url: input.url,
  })
}

export const parseDigimonCatalog = (input: readonly RawDigimonNode[]): DigimonCatalog => {
  const nodes = input.map(parseNode)
  const byId = new Map<string, DigimonNode>()

  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`Duplicate digimon id ${node.id}`)
    byId.set(node.id, node)
  }

  for (const node of nodes) {
    for (const targetId of node.nextEvolutions) {
      if (!byId.has(targetId)) throw new Error(`Invalid next_evolutions reference ${targetId} from ${node.id}`)
    }
  }

  return Object.freeze({ nodes: Object.freeze(nodes), byId })
}

export const DIGIMON_CATALOG = parseDigimonCatalog(DIGIMON_DATA)

export const loadDigimonCatalog = async (): Promise<DigimonCatalog> => DIGIMON_CATALOG
