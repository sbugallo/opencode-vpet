export type SidebarSnapshot = {
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly frozen: boolean
  readonly isSetOverride: boolean
  readonly trainerTotalTokens: number
  readonly pendingEvolutionTargetId: string | null
  readonly battleOpponentNodeId: string | null
}

export type SidebarSnapshotReader = {
  getSidebarSnapshot: () => SidebarSnapshot | null
}
