import type { Partner, PartnerProgression } from "@jcendal/digital-pet-core/domain/partner.ts"

export const idlePartnerBattleFields = {
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
} as const

export const testPartner = (overrides: Partial<Partner> = {}): Partner => ({
  partnerId: "partner-1",
  generation: 1,
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  createdAt: "2026-07-31T00:00:00.000Z",
  retiredAt: null,
  ...idlePartnerBattleFields,
  ...overrides,
})

export const partnerProgression = (
  partner: Partner,
  overrides: Partial<PartnerProgression> = {},
): PartnerProgression => ({
  currentNodeId: partner.currentNodeId,
  gauge: partner.gauge,
  isTerminal: partner.isTerminal,
  pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
  battleOpponentNodeId: partner.battleOpponentNodeId,
  ...overrides,
})
