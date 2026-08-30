import type { PartnerLifecycle } from "../application/ports/partner-lifecycle.ts"
import { spawnPartner } from "../application/use-cases/spawn-partner.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export type VpetSpawnContext = {
  readonly sessionID: string
  readonly messageID: string
  readonly createdAt: string
}

export const runVpetSpawnCommand = async (
  lifecycle: PartnerLifecycle,
  context: VpetSpawnContext,
): Promise<VpetCommandResult> => {
  const partner = spawnPartner(lifecycle, context.createdAt)

  return {
    parts: [
      {
        id: context.messageID,
        sessionID: context.sessionID,
        messageID: context.messageID,
        type: "text",
        text: `Spawned Generation ${partner.generation}.`,
      },
    ],
    event: { kind: "spawned", nodeId: "0-001", generation: partner.generation },
  }
}
