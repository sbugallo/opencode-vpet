import type { SidebarSnapshot } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"

export const battleSidebarSnapshot = (): SidebarSnapshot => ({
  currentNodeId: "3-001",
  gauge: 50,
  isTerminal: false,
  frozen: false,
  isSetOverride: false,
  trainerTotalTokens: 500,
  pendingEvolutionTargetId: "4-017",
  battleOpponentNodeId: "3-051",
})
