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

export const SP_TRANSACTION_LABELS: Record<string, string> = {
  initial: 'Starting award',
  friendly: 'Friendly match',
  tournament: 'Tournament match',
  season_deduction: 'Season deduction',
  correction: 'Correction',
  reversal: 'Reversal',
}
