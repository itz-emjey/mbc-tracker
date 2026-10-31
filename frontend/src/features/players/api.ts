import { errorMessage, isRole, ROLE_KEYS } from '@/features/auth/api'
import type { Role } from '@/features/auth/types'
import { getSupabaseClient } from '@/lib/supabase'

import type { LinkedProfile, PlayerInput, PlayerRecord } from './types'

/**
 * Player directory data access.
 *
 * Reads go through RLS: every approved member can see the directory and the
 * club-readable SP cache. Writes for staff go straight to the table because the
 * insert/update grants deliberately exclude `profile_id`; linking and role
 * changes cross audited RPCs instead.
 */

const PLAYER_COLUMNS = 'id, profile_id, full_name, gender, status, joined_on'

export async function listPlayers(): Promise<PlayerRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('players')
    .select(PLAYER_COLUMNS)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return (data ?? []) as PlayerRecord[]
}

export async function getPlayer(playerId: string): Promise<PlayerRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('players')
    .select(PLAYER_COLUMNS)
    .eq('id', playerId)
    .maybeSingle()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return (data as PlayerRecord | null) ?? null
}

export async function getPlayerByProfile(profileId: string): Promise<PlayerRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('players')
    .select(PLAYER_COLUMNS)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return (data as PlayerRecord | null) ?? null
}

/**
 * The cached SP balance for one player, or `null` when no row is visible.
 * `sp_accounts` is readable by club members, but a player record without an
 * account has no balance row; the UI hides the card in both cases.
 */
export async function getPlayerSp(playerId: string): Promise<number | null> {
  const { data, error } = await getSupabaseClient()
    .from('sp_accounts')
    .select('current_sp')
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data?.current_sp ?? null
}

export async function createPlayer(input: PlayerInput): Promise<PlayerRecord> {
  const { data, error } = await getSupabaseClient()
    .from('players')
    .insert({
      full_name: input.full_name,
      gender: input.gender,
      status: input.status,
      joined_on: input.joined_on,
    })
    .select(PLAYER_COLUMNS)
    .single()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data as PlayerRecord
}

export async function updatePlayer(playerId: string, input: PlayerInput): Promise<PlayerRecord> {
  const { data, error } = await getSupabaseClient()
    .from('players')
    .update({
      full_name: input.full_name,
      gender: input.gender,
      status: input.status,
      joined_on: input.joined_on,
    })
    .eq('id', playerId)
    .select(PLAYER_COLUMNS)
    .single()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data as PlayerRecord
}

export async function getLinkedProfile(profileId: string): Promise<LinkedProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, status')
    .eq('id', profileId)
    .maybeSingle()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data
}

export async function getProfileRoles(profileId: string): Promise<Role[]> {
  const supabase = getSupabaseClient()

  const assignments = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('profile_id', profileId)

  if (assignments.error) {
    throw new Error(errorMessage(assignments.error))
  }

  const roleIds = [...new Set((assignments.data ?? []).map((row) => row.role_id))]

  if (roleIds.length === 0) return []

  const roleRows = await supabase.from('roles').select('id, key').in('id', roleIds)

  if (roleRows.error) {
    throw new Error(errorMessage(roleRows.error))
  }

  const roles = (roleRows.data ?? [])
    .map((role) => role.key)
    .filter((key): key is Role => isRole(key))

  return [...new Set(roles)].sort(
    (left, right) => ROLE_KEYS.indexOf(left) - ROLE_KEYS.indexOf(right),
  )
}

export interface LinkOutcome {
  profile_id: string
  player_id: string
  changed: boolean
  already_linked?: boolean
}

export async function linkPlayerAccount(profileId: string, playerId: string): Promise<LinkOutcome> {
  const { data, error } = await getSupabaseClient().rpc('link_player_account', {
    p_profile_id: profileId,
    p_player_id: playerId,
  })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data as unknown as LinkOutcome
}

export async function unlinkPlayerAccount(playerId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('unlink_player_account', {
    p_player_id: playerId,
  })

  if (error) {
    throw new Error(errorMessage(error))
  }
}
