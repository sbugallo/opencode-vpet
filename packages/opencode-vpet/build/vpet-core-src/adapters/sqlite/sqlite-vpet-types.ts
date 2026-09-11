import type { Partner, PartnerProgression } from "../../domain/partner.ts"
import type { SpawnPartnerInput } from "../../application/models/spawn-partner.ts"
import type { ApplyUsageReceiptOutcome, UsageReceiptMetadata } from "../../application/models/usage.ts"
import type { PartnerLifecycle } from "../../application/ports/partner-lifecycle.ts"
import type { UsageLedger } from "../../application/ports/usage-ledger.ts"
import type { VpetControl } from "../../application/ports/vpet-control.ts"

export type PersistedPartner = Partner

export type PersistedPartnerEventKind = "spawned" | "usage_applied" | "retired"

export type PersistedPartnerEvent = {
  readonly eventId: string
  readonly partnerId: string
  readonly kind: PersistedPartnerEventKind
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly tokenDelta: number | null
  readonly receiptKey: string | null
  readonly createdAt: string
}

export type UsageReceiptRecord = {
  readonly receiptKey: string
  readonly partnerId: string
  readonly eventId: string
  readonly tokenDelta: number
  readonly createdAt: string
}

export type TrainerState = {
  readonly totalTokens: number
}

export type PersistedPartnerSummary = Partner

export type SqliteVpetWriteStore = PartnerLifecycle &
  UsageLedger &
  VpetControl & {
    close: () => Promise<void>
    readonly databasePath: string
    getAppliedMigrations: () => readonly number[]
    getTrainerState: () => TrainerState
    getActivePartner: () => PersistedPartner | null
    listPartners: () => readonly PersistedPartnerSummary[]
    getPartnerByGeneration: (generation: number) => PersistedPartnerSummary | null
    listPartnerEvents: (partnerId: string) => readonly PersistedPartnerEvent[]
    listUsageReceipts: () => readonly UsageReceiptRecord[]
  }

export type { ApplyUsageReceiptOutcome, PartnerProgression, SpawnPartnerInput, UsageReceiptMetadata }
