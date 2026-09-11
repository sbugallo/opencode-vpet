import type { DigimonNode } from "../../domain/digimon-node.ts"

export type SidebarCardInputs =
  | { readonly kind: "no_partner" }
  | {
      readonly kind: "partner"
      readonly node: DigimonNode
      readonly gauge: number
      readonly isTerminal: boolean
      readonly frozen: boolean
      readonly isSetOverride: boolean
      readonly trainerTotalTokens: number
    }
