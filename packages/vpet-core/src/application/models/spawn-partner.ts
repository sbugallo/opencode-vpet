export type SpawnPartnerInput = {
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly createdAt: string
}

export type SpawnPartnerResult = {
  readonly generation: number
}
