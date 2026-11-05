/**
 * Tournament types.
 *
 * These mirror migration 005. They describe data, not permissions: the database
 * is SELECT-only for every tournament table, and every write crosses an audited
 * RPC.
 */

import type { Role } from '@/features/auth/types'

export type TournamentStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
export type Discipline = 'singles' | 'mens_doubles' | 'womens_doubles' | 'mixed_doubles'
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin'
export type TournamentEntryStatus = 'registered' | 'withdrawn' | 'disqualified'
export type PaymentStatus = 'unpaid' | 'paid' | 'waived'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type MatchStatus = 'pending' | 'completed' | 'cancelled'
export type MatchBracket = 'winners' | 'losers' | 'grand_final' | 'round_robin'
export type SlotOutcome = 'winner' | 'loser'

/** Roles allowed to create tournaments, draws, entries, and results. */
export const TOURNAMENT_STAFF_ROLES: readonly Role[] = ['super_admin', 'tournament_manager']

export const TOURNAMENT_STATUSES: readonly TournamentStatus[] = [
  'draft',
  'published',
  'in_progress',
  'completed',
  'archived',
]

export const DISCIPLINES: readonly Discipline[] = [
  'singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles',
]

export const TOURNAMENT_FORMATS: readonly TournamentFormat[] = [
  'single_elimination',
  'double_elimination',
  'round_robin',
]

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived',
}

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  singles: 'Singles',
  mens_doubles: "Men's Doubles",
  womens_doubles: "Women's Doubles",
  mixed_doubles: 'Mixed Doubles',
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  single_elimination: 'Single elimination',
  double_elimination: 'Double elimination',
  round_robin: 'Round robin',
}

export const MATCH_BRACKET_LABELS: Record<MatchBracket, string> = {
  winners: 'Winners bracket',
  losers: 'Losers bracket',
  grand_final: 'Grand final',
  round_robin: 'Round robin',
}

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['unpaid', 'paid', 'waived']

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  waived: 'Waived',
}

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Awaiting reply',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export interface TournamentRecord {
  id: string
  name: string
  description: string | null
  venue: string | null
  starts_on: string
  ends_on: string
  registration_deadline: string | null
  poster_path: string | null
  entrance_fee: number
  status: TournamentStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TournamentEventRecord {
  id: string
  tournament_id: string
  discipline: Discipline
  format: TournamentFormat
  max_entries: number
  draw_generated_at: string | null
  created_at: string
  updated_at: string
}

export interface TeamRecord {
  id: string
  event_id: string
  name: string | null
  created_at: string
}

export interface TeamMemberRecord {
  id: string
  team_id: string
  player_id: string | null
  guest_name: string | null
  guest_gender: string | null
}

export interface TournamentEntryRecord {
  id: string
  event_id: string
  player_id: string | null
  team_id: string | null
  seed: number | null
  status: TournamentEntryStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * One participant's entrance-fee row. A doubles team has one row per player and
 * one for a guest partner, because the fee is charged per player.
 */
export interface PaymentRecord {
  id: string
  entry_id: string
  player_id: string | null
  guest_name: string | null
  amount: number
  status: PaymentStatus
  marked_by: string | null
  marked_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}

/**
 * How far a tournament's board has moved, for the list view. Counts only:
 * a draw exists per event, and a match is played once it has a result.
 */
export interface TournamentProgress {
  events: number
  drawnEvents: number
  matches: number
  playedMatches: number
}

/** A pending or answered doubles invitation. No entry exists until accepted. */
export interface PartnerInvitationRecord {
  id: string
  event_id: string
  inviter_player_id: string
  partner_player_id: string
  entry_id: string | null
  status: InvitationStatus
  created_by: string | null
  created_at: string
  responded_at: string | null
}

export interface MatchRecord {
  id: string
  event_id: string
  bracket: MatchBracket
  round: number
  position: number
  home_entry_id: string | null
  away_entry_id: string | null
  home_source_match_id: string | null
  away_source_match_id: string | null
  home_source_outcome: SlotOutcome | null
  away_source_outcome: SlotOutcome | null
  winner_entry_id: string | null
  status: MatchStatus
  conditional: boolean
  reset: boolean
  recorded_by: string | null
  recorded_at: string | null
  created_at: string
  updated_at: string
}

export interface MatchGameRecord {
  match_id: string
  game_number: number
  home_points: number
  away_points: number
}

export interface TournamentDetail {
  tournament: TournamentRecord
  events: TournamentEventRecord[]
  entries: TournamentEntryRecord[]
  teams: TeamRecord[]
  teamMembers: TeamMemberRecord[]
  payments: PaymentRecord[]
  invitations: PartnerInvitationRecord[]
  matches: MatchRecord[]
  games: MatchGameRecord[]
}

export interface TournamentInput {
  name: string
  starts_on: string
  ends_on: string
  venue: string | null
  description: string | null
  registration_deadline: string | null
  entrance_fee: number
}

export interface TournamentEventInput {
  discipline: Discipline
  format: TournamentFormat
  max_entries: number
}

export interface GameScoreInput {
  home_points: number
  away_points: number
}

export interface DrawOutcome {
  event_id: string
  match_count: number
  entry_count: number
  replaced: boolean
}

export interface EntryOutcome {
  entry_id: string
  event_id: string
  player_ids: string[]
  team_id: string | null
  seed: number | null
  status: TournamentEntryStatus
}

export interface ResultOutcome {
  match_id: string
  winner_entry_id: string
  loser_entry_id: string
  home_games: number
  away_games: number
}

/** A player registered themselves; no partner invitation was needed. */
export interface SelfEntryOutcome {
  status: 'registered'
  entry_id: string
  event_id: string
  payment_status: PaymentStatus
  entrance_fee: number
  guest_name?: string
}

/** A club partner must accept before the team and entry exist. */
export interface PartnerInviteOutcome {
  status: 'pending_partner'
  invitation_id: string
  event_id: string
  partner_player_id: string
  entrance_fee: number
}

export type JoinEventOutcome = SelfEntryOutcome | PartnerInviteOutcome

export interface InvitationOutcome {
  invitation_id: string
  status: InvitationStatus
  changed: boolean
  entry_id?: string
  event_id?: string
  payment_status?: PaymentStatus
}

export interface WithdrawalOutcome {
  entry_id: string
  status: TournamentEntryStatus
  changed: boolean
}

export interface PaymentOutcome {
  payment_id: string
  entry_id: string
  status: PaymentStatus
}
