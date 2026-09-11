import type { Partner } from "../../domain/partner.ts"
import type { SpawnPartnerInput } from "../models/spawn-partner.ts"

export type PartnerLifecycle = {
  spawnPartner: (input: SpawnPartnerInput) => Partner
}
