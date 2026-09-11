export type Partner = {
  readonly partnerId: string
  readonly generation: number
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly pendingEvolutionTargetId: string | null
  readonly battleOpponentNodeId: string | null
  readonly createdAt: string
  readonly retiredAt: string | null
}

export type PartnerProgression = {
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly pendingEvolutionTargetId: string | null
  readonly battleOpponentNodeId: string | null
}
