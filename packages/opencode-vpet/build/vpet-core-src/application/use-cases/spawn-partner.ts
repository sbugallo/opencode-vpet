import type { PartnerLifecycle } from "../ports/partner-lifecycle.ts"
import type { SpawnPartnerResult } from "../models/spawn-partner.ts"

export const spawnPartner = (lifecycle: PartnerLifecycle, createdAt: string): SpawnPartnerResult => {
  const partner = lifecycle.spawnPartner({
    currentNodeId: "0-001",
    gauge: 0,
    isTerminal: false,
    createdAt,
  })

  return { generation: partner.generation }
}
