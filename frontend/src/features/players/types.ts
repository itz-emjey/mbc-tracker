/**
 * Player directory types.
 *
 * These mirror the `players` table. They describe data, not permissions: the
 * database still decides which rows and columns a caller can read or write.
 */

export type PlayerStatus = 'active' | 'inactive' | 'suspended'
export type PlayerGender = 'male' | 'female'
export type PlayerRatingStatus = 'unrated' | 'rated'

/** Roles allowed to add and correct player records, mirroring the SQL grants. */
export const PLAYER_STAFF_ROLES = ['super_admin', 'tournament_manager', 'trainer'] as const

export const PLAYER_STATUSES: readonly PlayerStatus[] = ['active', 'inactive', 'suspended']
export const PLAYER_GENDERS: readonly PlayerGender[] = ['male', 'female']
export const PLAYER_RATING_STATUSES: readonly PlayerRatingStatus[] = ['unrated', 'rated']

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
}

export const PLAYER_RATING_STATUS_LABELS: Record<PlayerRatingStatus, string> = {
  unrated: 'Unrated',
  rated: 'Rated',
}

export const PLAYER_GENDER_LABELS: Record<PlayerGender, string> = {
  male: 'Male',
  female: 'Female',
}

export interface PlayerRecord {
  id: string
  player_code: string
  profile_id: string | null
  full_name: string
  gender: PlayerGender | null
  status: PlayerStatus
  rating_status: PlayerRatingStatus
  joined_on: string
}

/** Fields staff may write. `profile_id` is intentionally absent: it is RPC-only. */
export interface PlayerInput {
  full_name: string
  gender: PlayerGender | null
  status: PlayerStatus
  joined_on: string
}

export interface LinkedProfile {
  id: string
  full_name: string
  status: string
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'removed'

export const FRIENDSHIP_STATUS_LABELS: Record<FriendshipStatus, string> = {
  pending: 'Pending',
  accepted: 'Friends',
  declined: 'Declined',
  removed: 'Removed',
}

/** One friendship row. RLS shows only the two players involved. */
export interface FriendshipRecord {
  id: string
  requester_player_id: string
  addressee_player_id: string
  status: FriendshipStatus
  requested_at: string
  responded_at: string | null
}

/** A friend joined with the directory record the UI displays. */
export interface FriendEntry {
  friendshipId: string
  player: PlayerRecord
  status: FriendshipStatus
  /** True when the signed-in player sent the request. */
  outgoing: boolean
}
