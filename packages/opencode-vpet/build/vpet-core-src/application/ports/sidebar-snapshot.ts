export type SidebarSnapshot = {
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly frozen: boolean
  readonly isSetOverride: boolean
  readonly trainerTotalTokens: number
}

export type SidebarSnapshotReader = {
  getSidebarSnapshot: () => SidebarSnapshot | null
}
