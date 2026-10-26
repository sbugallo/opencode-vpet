import type { PartnerLifecycle } from "../ports/partner-lifecycle.ts"
import type { SpawnPartnerResult } from "../models/spawn-partner.ts"

export const spawnPartner = (
  lifecycle: PartnerLifecycle,
  currentNodeId: string,
  createdAt: string,
): SpawnPartnerResult => {
  const partner = lifecycle.spawnPartner({
    currentNodeId,
    gauge: 0,
    isTerminal: false,
    createdAt,
  })

  return { generation: partner.generation, currentNodeId: partner.currentNodeId }
}
