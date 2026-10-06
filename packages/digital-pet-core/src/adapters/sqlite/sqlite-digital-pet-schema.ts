import type { Partner } from "../../domain/partner.ts"
import type {
  PersistedPartnerEvent,
  PersistedPartnerEventKind,
  UsageReceiptRecord,
} from "./sqlite-digital-pet-types.ts"

export type PersistedPartnerRow = {
  readonly partner_id: string
  readonly generation: number
  readonly current_node_id: string
  readonly gauge: number
  readonly is_terminal: number
  readonly pending_evolution_target_id: string | null
  readonly battle_opponent_node_id: string | null
  readonly created_at: string
  readonly retired_at: string | null
}

export type PersistedPartnerEventRow = {
  readonly event_id: string
  readonly partner_id: string
  readonly kind: PersistedPartnerEventKind
  readonly current_node_id: string
  readonly gauge: number
  readonly is_terminal: number
  readonly token_delta: number | null
  readonly receipt_key: string | null
  readonly created_at: string
}

export type UsageReceiptRow = {
  readonly receipt_key: string
  readonly partner_id: string
  readonly event_id: string
  readonly token_delta: number
  readonly cost: number | null
  readonly created_at: string
}

export type TrainerStateRow = {
  readonly total_tokens: number
}

export type MigrationRow = {
  readonly version: number
}

const PARTNER_COLUMNS = `
    partner_id,
    generation,
    current_node_id,
    gauge,
    is_terminal,
    pending_evolution_target_id,
    battle_opponent_node_id,
    created_at,
    retired_at
`

export const ACTIVE_PARTNER_SELECT = `
  SELECT
    ${PARTNER_COLUMNS}
  FROM partners
  WHERE retired_at IS NULL
  LIMIT 1
`

export const PARTNERS_SELECT = `
  SELECT
    ${PARTNER_COLUMNS}
  FROM partners
  ORDER BY generation ASC, created_at ASC, partner_id ASC
`

export const ARCHIVE_PARTNERS_SELECT = `
  SELECT
    ${PARTNER_COLUMNS}
  FROM partners
  ORDER BY partner_id ASC
`

export const PARTNER_BY_GENERATION_SELECT = `
  SELECT
    ${PARTNER_COLUMNS}
  FROM partners
  WHERE generation = ?
  LIMIT 1
`

export const PARTNER_EVENTS_SELECT = `
  SELECT
    event_id,
    partner_id,
    kind,
    current_node_id,
    gauge,
    is_terminal,
    token_delta,
    receipt_key,
    created_at
  FROM partner_events
  WHERE partner_id = ?
  ORDER BY created_at ASC, event_id ASC
`

export const ARCHIVE_PARTNER_EVENTS_SELECT = `
  SELECT
    event_id,
    partner_id,
    kind,
    current_node_id,
    gauge,
    is_terminal,
    token_delta,
    receipt_key,
    created_at
  FROM partner_events
  ORDER BY partner_id ASC, created_at ASC, event_id ASC
`

export const USAGE_RECEIPTS_SELECT = `
  SELECT receipt_key, partner_id, event_id, token_delta, cost, created_at
  FROM usage_receipts
  ORDER BY created_at ASC, receipt_key ASC
`

export const toPartner = (row: PersistedPartnerRow): Partner => {
  return {
    partnerId: row.partner_id,
    generation: row.generation,
    currentNodeId: row.current_node_id,
    gauge: row.gauge,
    isTerminal: row.is_terminal === 1,
    pendingEvolutionTargetId: row.pending_evolution_target_id,
    battleOpponentNodeId: row.battle_opponent_node_id,
    createdAt: row.created_at,
    retiredAt: row.retired_at,
  }
}

export const toPersistedPartnerEvent = (row: PersistedPartnerEventRow): PersistedPartnerEvent => {
  return {
    eventId: row.event_id,
    partnerId: row.partner_id,
    kind: row.kind,
    currentNodeId: row.current_node_id,
    gauge: row.gauge,
    isTerminal: row.is_terminal === 1,
    tokenDelta: row.token_delta,
    receiptKey: row.receipt_key,
    createdAt: row.created_at,
  }
}

export const toUsageReceiptRecord = (row: UsageReceiptRow): UsageReceiptRecord => {
  return {
    receiptKey: row.receipt_key,
    partnerId: row.partner_id,
    eventId: row.event_id,
    tokenDelta: row.token_delta,
    createdAt: row.created_at,
  }
}
