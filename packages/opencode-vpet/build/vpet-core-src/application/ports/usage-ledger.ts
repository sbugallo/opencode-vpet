import type { Partner, PartnerProgression } from "../../domain/partner.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../models/usage.ts"

export type UsageLedger = {
  applyUsageReceipt: (
    metadata: UsageReceiptMetadata,
    evolve: (partner: Partner) => PartnerProgression,
  ) => ApplyUsageReceiptOutcome
}
