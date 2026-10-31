import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type { FriendlyMatchRecord } from './types'

/**
 * Friendly match data access.
 *
 * Reads are filtered by RLS (participants and Super Admins). Every write
 * crosses the audited RPCs in migration 010, which also own the 24-hour
 * approval window. Nothing here awards ShuttlePower.
 */

const MATCH_COLUMNS =
  'id, challenger_id, opponent_id, note, status, winner_id, submitted_by, submitted_at, auto_approval_due_at, responded_by, responded_at, confirmed_at, dispute_reason, disputed_at, created_at'

export async function listFriendlyMatches(): Promise<FriendlyMatchRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('friendly_matches')
    .select(MATCH_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as FriendlyMatchRecord[]
}

export async function createFriendlyChallenge(
  opponentId: string,
  note: string | null,
): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_friendly_challenge', {
    p_opponent_id: opponentId,
    p_note: note,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function respondFriendlyChallenge(matchId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabaseClient().rpc('respond_friendly_challenge', {
    p_match_id: matchId,
    p_accept: accept,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function cancelFriendlyChallenge(matchId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('cancel_friendly_challenge', {
    p_match_id: matchId,
  })

  if (error) throw new Error(errorMessage(error))
}

/** Only the winner may call this; the server rejects anyone else. */
export async function submitFriendlyResult(matchId: string, winnerId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('submit_friendly_result', {
    p_match_id: matchId,
    p_winner_id: winnerId,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function approveFriendlyResult(matchId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('approve_friendly_result', {
    p_match_id: matchId,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function disputeFriendlyResult(matchId: string, reason: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('dispute_friendly_result', {
    p_match_id: matchId,
    p_reason: reason,
  })

  if (error) throw new Error(errorMessage(error))
}
