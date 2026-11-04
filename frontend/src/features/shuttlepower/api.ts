import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type {
  PlacementAuditRecord,
  PlacementProgressRecord,
  ReconciliationResult,
  SeasonDeductionBatchRecord,
  SeasonOperationResult,
  SeasonRecord,
  SeasonTransitionRecord,
  SeasonalStandingRecord,
  SpLeaderboardEntry,
  SpRuleVersionRecord,
  SpTransactionRecord,
} from './types'

/**
 * ShuttlePower data access.
 *
 * Every read is a plain SELECT governed by RLS: club members see the directory
 * balances and the rule versions, a player sees only their own ledger rows, and
 * a Super Admin can run the balance check. There is no write path here at all —
 * SP awards need the approved formula and land with the match workflows.
 */

const RULE_COLUMNS = 'id, version, status, config, is_enabled, effective_from, notes, created_at'

export async function listRuleVersions(): Promise<SpRuleVersionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('sp_rule_versions')
    .select(RULE_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SpRuleVersionRecord[]
}

/** The newest rule version. It is the only one the UI may quote. */
export async function getCurrentRuleVersion(): Promise<SpRuleVersionRecord | null> {
  const versions = await listRuleVersions()

  return versions[0] ?? null
}

export async function listSpLeaderboard(): Promise<SpLeaderboardEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from('published_sp_leaderboard')
    .select('player_id, full_name, status, rating_status, current_sp')
    .order('current_sp', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  type Row = {
    current_sp: number
    full_name: string
    player_id: string
    rating_status: 'unrated' | 'rated'
    status: SpLeaderboardEntry['status']
  }

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    playerId: row.player_id,
    fullName: row.full_name,
    status: row.status,
    ratingStatus: row.rating_status,
    sp: row.current_sp,
  }))
}

/** One player's published ledger, newest first (D17). */
export async function listPlayerSpHistory(
  playerId: string,
  limit = 25,
): Promise<SpTransactionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('published_sp_transactions')
    .select(
      'id, player_id, transaction_type, sp_before, sp_delta, sp_after, reference_type, reference_id, rule_version, created_at',
    )
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SpTransactionRecord[]
}

/** D15/D17: visible progress, never the provisional SP value. */
export async function getPlacementProgress(
  playerId: string,
): Promise<PlacementProgressRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('placement_progress')
    .select('player_id, rating_status, credits, required, qualified_at')
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) throw new Error(errorMessage(error))

  return (data as PlacementProgressRecord | null) ?? null
}

/** D17: Super Admin-only audit of provisional balances and qualifications. */
export async function listPlacementAudit(): Promise<PlacementAuditRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('placement_audit')
    .select(
      `player_id, full_name, rating_status, current_sp, credits, required,
       qualified_at, published_sp, qualification_rule_version`,
    )
    .order('rating_status', { ascending: true })
    .order('full_name', { ascending: true })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as PlacementAuditRecord[]
}

/** Super Admin only; the RPC re-checks authority and never writes a repair. */
export async function reconcileSpBalances(): Promise<ReconciliationResult> {
  const { data, error } = await getSupabaseClient().rpc('reconcile_sp_balances')

  if (error) throw new Error(errorMessage(error))

  return data as unknown as ReconciliationResult
}

// ---------------------------------------------------------------------------
// Seasons (S1-S23)
// ---------------------------------------------------------------------------

export async function listSeasons(): Promise<SeasonRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('seasons')
    .select('id, label, starts_on, ends_on, status, started_at, closed_at, created_at')
    .order('starts_on', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SeasonRecord[]
}

/**
 * S15: the provisional live table while a season is open, or the frozen
 * snapshot once it is closed. Omitting the id reads the active season, then the
 * newest one.
 */
export async function listSeasonalStandings(
  seasonId?: string | null,
): Promise<SeasonalStandingRecord[]> {
  const { data, error } = await getSupabaseClient().rpc('seasonal_standings', {
    p_season_id: seasonId ?? null,
  })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SeasonalStandingRecord[]
}

/** Super Admin only. Creates a scheduled season; overlapping dates are refused. */
export async function createSeason(
  label: string,
  startsOn: string,
  endsOn: string,
): Promise<SeasonOperationResult> {
  const { data, error } = await getSupabaseClient().rpc('create_season', {
    p_label: label,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as SeasonOperationResult
}

/** Super Admin only. Replaying activation is a no-op. */
export async function startSeason(seasonId: string): Promise<SeasonOperationResult> {
  const { data, error } = await getSupabaseClient().rpc('start_season', {
    p_season_id: seasonId,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as SeasonOperationResult
}

/** Super Admin only. Freezes the snapshot and creates the pending batch. */
export async function closeSeason(seasonId: string): Promise<SeasonOperationResult> {
  const { data, error } = await getSupabaseClient().rpc('close_season', {
    p_season_id: seasonId,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as SeasonOperationResult
}

/** Super Admin only. Approving applies each entry exactly once (S9). */
export async function decideDeductionBatch(
  batchId: string,
  approve: boolean,
  reason?: string,
): Promise<SeasonOperationResult> {
  const { data, error } = await getSupabaseClient().rpc('decide_season_deduction_batch', {
    p_batch_id: batchId,
    p_approve: approve,
    p_reason: reason ?? null,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as SeasonOperationResult
}

export async function listDeductionBatches(): Promise<SeasonDeductionBatchRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('season_deduction_batches')
    .select(
      `id, season_id, status, generated_at, decided_at, rejection_reason,
       season:seasons!season_deduction_batches_season_id_fkey(id, label),
       entries:season_deduction_entries!season_deduction_entries_batch_id_fkey(
         id, batch_id, player_id, position, tier, proposed_amount, applied_amount, waived_amount,
         player:players!season_deduction_entries_player_id_fkey(id, full_name)
       )`,
    )
    .order('generated_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SeasonDeductionBatchRecord[]
}

export async function listSeasonTransitions(): Promise<SeasonTransitionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('season_transitions')
    .select(
      `id, season_id, status, attempts, last_error, started_at, completed_at,
       season:seasons!season_transitions_season_id_fkey(id, label)`,
    )
    .order('started_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SeasonTransitionRecord[]
}

/** Super Admin only. `force` clears the retry limit after a failed transition (S20). */
export async function runSeasonTransition(force = true): Promise<SeasonOperationResult> {
  const { data, error } = await getSupabaseClient().rpc('run_season_transition', {
    p_force: force,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as SeasonOperationResult
}
