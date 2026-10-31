import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type {
  ReconciliationResult,
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
    .from('sp_accounts')
    .select('current_sp, player:players!sp_accounts_player_id_fkey(id, full_name, status)')
    .order('current_sp', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  type Row = {
    current_sp: number
    player: { id: string; full_name: string; status: SpLeaderboardEntry['status'] } | null
  }

  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.player !== null)
    .map((row) => ({
      playerId: row.player!.id,
      fullName: row.player!.full_name,
      status: row.player!.status,
      sp: row.current_sp,
    }))
}

/** One player's ledger, newest first. RLS limits this to the caller's own rows. */
export async function listPlayerSpHistory(
  playerId: string,
  limit = 25,
): Promise<SpTransactionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('sp_transactions')
    .select(
      'id, player_id, transaction_type, sp_before, sp_delta, sp_after, reference_type, reference_id, rule_version, created_at',
    )
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as SpTransactionRecord[]
}

/** Super Admin only; the RPC re-checks authority and never writes a repair. */
export async function reconcileSpBalances(): Promise<ReconciliationResult> {
  const { data, error } = await getSupabaseClient().rpc('reconcile_sp_balances')

  if (error) throw new Error(errorMessage(error))

  return data as unknown as ReconciliationResult
}
