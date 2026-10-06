import type { PartnerLifecycle } from "@jcendal/digital-pet-core/application/ports/partner-lifecycle.ts"
import { spawnPartner } from "@jcendal/digital-pet-core/application/use-cases/spawn-partner.ts"
import type { DigitalPetCommandResult } from "./digital-pet-command-result.ts"

export type DigitalPetSpawnContext = {
  readonly sessionID: string
  readonly messageID: string
  readonly createdAt: string
}

export const runDigitalPetSpawnCommand = async (
  lifecycle: PartnerLifecycle,
  context: DigitalPetSpawnContext,
): Promise<DigitalPetCommandResult> => {
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
