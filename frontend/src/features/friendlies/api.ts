import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type { FriendlyMatchRecord, FriendlyMatchType } from './types'

/**
 * Friendly match data access.
 *
 * Reads are filtered by RLS (participants, partners, and Super Admins). Every
 * write crosses the audited RPCs in migrations 010 and 020, which also own the
 * 24-hour approval window. Nothing here awards ShuttlePower.
 */

const MATCH_COLUMNS =
  'id, match_type, challenger_id, challenger_partner_id, opponent_id, opponent_partner_id, note, status, winner_id, submitted_by, submitted_at, auto_approval_due_at, responded_by, responded_at, confirmed_at, challenger_approved_at, challenger_partner_approved_at, opponent_approved_at, opponent_partner_approved_at, dispute_reason, disputed_at, created_at'

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
  type: FriendlyMatchType = 'singles',
  partnerId: string | null = null,
): Promise<{ id: string }> {
  const client = getSupabaseClient()

  if (type === 'doubles') {
    if (!partnerId) throw new Error('Choose a doubles partner.')

    const { data, error } = await client.rpc('create_doubles_friendly_challenge', {
      p_opponent_id: opponentId,
      p_partner_id: partnerId,
      p_note: note,
    })

    if (error) throw new Error(errorMessage(error))

    return data as unknown as { id: string }
  }

  const { data, error } = await client.rpc('create_friendly_challenge', {
    p_opponent_id: opponentId,
    p_note: note,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function respondFriendlyChallenge(
  matchId: string,
  accept: boolean,
  partnerId: string | null = null,
  type: FriendlyMatchType = 'singles',
): Promise<void> {
  const client = getSupabaseClient()

  if (type === 'doubles') {
    const { error } = await client.rpc('respond_doubles_friendly_challenge', {
      p_match_id: matchId,
      p_accept: accept,
      p_partner_id: accept ? partnerId : null,
    })

    if (error) throw new Error(errorMessage(error))

    return
  }

  const { error } = await client.rpc('respond_friendly_challenge', {
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

/** The winning team submits its captain; either partner may call this. */
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
