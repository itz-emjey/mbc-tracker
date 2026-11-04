/**
 * ShuttlePower records.
 *
 * These mirror migration 006 and the Phase 1 SP tables. They describe data, not
 * permissions: clients read SP, and only privileged RPCs ever write it.
 */

import type { SpRuleConfig, SpRuleStatus } from '@/domain/sp'
import type { PlayerStatus } from '@/features/players/types'

export interface SpRuleVersionRecord {
  id: string
  version: string
  status: SpRuleStatus
  config: SpRuleConfig
  is_enabled: boolean
  effective_from: string | null
  notes: string | null
  created_at: string
}

export interface SpLeaderboardEntry {
  playerId: string
  fullName: string
  status: PlayerStatus
  sp: number
}

export interface SpTransactionRecord {
  id: string
  player_id: string
  transaction_type: string
  sp_before: number
  sp_delta: number
  sp_after: number
  reference_type: string | null
  reference_id: string | null
  rule_version: string | null
  created_at: string
}

export interface ReconciliationMismatch {
  player_id: string
  cached_sp: number
  ledger_sp: number
}

export interface ReconciliationResult {
  checked: number
  mismatches: ReconciliationMismatch[]
  consistent: boolean
}

export type SeasonStatus = 'scheduled' | 'active' | 'closed'

export interface SeasonRecord {
  id: string
  label: string
  starts_on: string
  ends_on: string
  status: SeasonStatus
  started_at: string | null
  closed_at: string | null
  created_at: string
}

/** S19: why a player has no displayed seasonal position. */
export type SeasonExclusionReason =
  'negative_seasonal_sp' | 'no_eligible_matches' | 'inactive_or_unlinked'

export interface SeasonalStandingRecord {
  season_id: string
  player_id: string
  full_name: string
  seasonal_sp: number
  matches_played: number
  wins: number
  tournament_matches: number
  tournament_wins: number
  game_difference: number
  point_difference: number
  position: number | null
  excluded_reason: SeasonExclusionReason | null
  /** True while the season is open; false once the snapshot is frozen (S15). */
  provisional: boolean
}

export type DeductionBatchStatus = 'pending' | 'approved' | 'rejected'

export interface SeasonDeductionEntryRecord {
  id: string
  batch_id: string
  player_id: string
  position: number
  tier: number
  proposed_amount: number
  applied_amount: number | null
  waived_amount: number | null
  player: { id: string; full_name: string } | null
}

export interface SeasonDeductionBatchRecord {
  id: string
  season_id: string
  status: DeductionBatchStatus
  generated_at: string
  decided_at: string | null
  rejection_reason: string | null
  season: { id: string; label: string } | null
  entries: SeasonDeductionEntryRecord[]
}

export type SeasonTransitionStatus = 'running' | 'failed' | 'completed'

export interface SeasonTransitionRecord {
  id: string
  season_id: string
  status: SeasonTransitionStatus
  attempts: number
  last_error: string | null
  started_at: string
  completed_at: string | null
  season: { id: string; label: string } | null
}

/** Shared shape of the audited seasonal RPC responses. */
export interface SeasonOperationResult {
  id?: string
  status?: string
  already_processed?: boolean
  snapshots?: number
  deduction_entries?: number
  batch_id?: string
  season_id?: string
  new_season_id?: string
  attempts?: number
  applied?: number
  applied_total?: number
  error?: string
  reason?: string
}

export const SEASON_EXCLUSION_LABELS: Record<SeasonExclusionReason, string> = {
  negative_seasonal_sp: 'Negative Seasonal SP',
  no_eligible_matches: 'No eligible matches',
  inactive_or_unlinked: 'Inactive or unlinked',
}

export const SP_TRANSACTION_LABELS: Record<string, string> = {
  initial: 'Starting award',
  friendly: 'Friendly match',
  tournament: 'Tournament match',
  season_deduction: 'Season deduction',
  correction: 'Correction',
  reversal: 'Reversal',
}
