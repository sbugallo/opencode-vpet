export type UsageReceiptMetadata = {
  readonly receiptKey: string
  readonly eventId: string
  readonly tokenDelta: number
  readonly cost?: number | null
  readonly createdAt: string
}

export type ApplyUsageReceiptOutcome =
  | { readonly kind: "applied" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "no_active_partner" }

export type UsageEvolutionTransition = {
  readonly fromNodeId: string
  readonly toNodeId: string
}

export type UsageProcessingResult =
  | {
      readonly kind: "applied"
      readonly receiptKey: string
      readonly evolution?: UsageEvolutionTransition
    }
  | { readonly kind: "duplicate"; readonly receiptKey: string }
  | { readonly kind: "no_active_partner"; readonly receiptKey: string }
