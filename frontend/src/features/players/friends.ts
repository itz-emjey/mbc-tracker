import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type { FriendEntry, FriendshipRecord, PlayerRecord } from './types'

/**
 * Player ID and friend data access.
 *
 * Friendships are read-only for clients; every mutation crosses an audited RPC
 * that uses `auth.uid()` for the actor. The rules — active, linked players only,
 * request then accept — live in migration 013.
 */

const FRIENDSHIP_COLUMNS =
  'id, requester_player_id, addressee_player_id, status, requested_at, responded_at'

export async function listFriendships(): Promise<FriendshipRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('player_friendships')
    .select(FRIENDSHIP_COLUMNS)
    .order('requested_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as FriendshipRecord[]
}

export interface FriendRequestOutcome {
  friendship_id: string
  status: 'pending' | 'accepted' | 'declined' | 'removed'
  changed: boolean
  already_friends?: boolean
}

export async function sendFriendRequest(playerCode: string): Promise<FriendRequestOutcome> {
  const { data, error } = await getSupabaseClient().rpc('send_player_friend_request', {
    p_player_code: playerCode,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as FriendRequestOutcome
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<FriendRequestOutcome> {
  const { data, error } = await getSupabaseClient().rpc('respond_player_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as FriendRequestOutcome
}

export async function removeFriend(playerId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('remove_player_friend', {
    p_player_id: playerId,
  })

  if (error) throw new Error(errorMessage(error))
}

/**
 * Joins the visible friendships to directory records and drops any row whose
 * other player is not visible. Pure so the pairing rule is testable.
 */
export function buildFriendEntries(
  friendships: readonly FriendshipRecord[],
  playersById: ReadonlyMap<string, PlayerRecord>,
  currentPlayerId: string,
): FriendEntry[] {
  const entries: FriendEntry[] = []

  for (const friendship of friendships) {
    if (friendship.status !== 'accepted' && friendship.status !== 'pending') continue

    const outgoing = friendship.requester_player_id === currentPlayerId
    const otherId = outgoing ? friendship.addressee_player_id : friendship.requester_player_id
    const player = playersById.get(otherId)

    if (!player) continue

    entries.push({
      friendshipId: friendship.id,
      player,
      status: friendship.status,
      outgoing,
    })
  }

  return entries.sort((left, right) => left.player.full_name.localeCompare(right.player.full_name))
}

/** Accepted friends only, the pool the doubles partner picker may offer. */
export function acceptedFriendPlayerIds(entries: readonly FriendEntry[]): string[] {
  return entries.filter((entry) => entry.status === 'accepted').map((entry) => entry.player.id)
}
