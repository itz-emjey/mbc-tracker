/**
 * Friendly match rules that the UI needs.
 *
 * The database is the authority; these helpers only decide which buttons to
 * show and how to describe the 24-hour window. They stay pure so every rule can
 * be tested without a session.
 */

import { FRIENDLY_APPROVAL_HOURS, type FriendlyMatchRecord, type FriendlyStatus } from './types'

const OPEN_STATUSES: readonly FriendlyStatus[] = ['pending', 'accepted', 'awaiting_approval']
const CLOSED_STATUSES: readonly FriendlyStatus[] = [
  'declined',
  'cancelled',
  'confirmed',
  'auto_approved',
  'disputed',
]

export type FriendlyTeam = 'challenger' | 'opponent'

export function isOpenFriendly(status: FriendlyStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

/** No further action is possible by either player. */
export function isClosedFriendly(status: FriendlyStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

/** Which team a player belongs to, or `null` for an outsider. */
export function teamOf(match: FriendlyMatchRecord, playerId: string): FriendlyTeam | null {
  if (match.challenger_id === playerId || match.challenger_partner_id === playerId) {
    return 'challenger'
  }

  if (match.opponent_id === playerId || match.opponent_partner_id === playerId) {
    return 'opponent'
  }

  return null
}

/** The captain of a player's team. Doubles partners share the captain. */
export function captainOf(match: FriendlyMatchRecord, playerId: string): string | null {
  const team = teamOf(match, playerId)

  if (team === 'challenger') return match.challenger_id
  if (team === 'opponent') return match.opponent_id

  return null
}

/** The other member of a player's team, or `null` for singles/outsiders. */
export function partnerOf(match: FriendlyMatchRecord, playerId: string): string | null {
  const team = teamOf(match, playerId)

  if (team === 'challenger') {
    return match.challenger_id === playerId ? match.challenger_partner_id : match.challenger_id
  }

  if (team === 'opponent') {
    return match.opponent_id === playerId ? match.opponent_partner_id : match.opponent_id
  }

  return null
}

/** The opposing captain. Used for copy, not for permissions. */
export function opponentOf(match: FriendlyMatchRecord, playerId: string): string | null {
  const team = teamOf(match, playerId)

  if (team === 'challenger') return match.opponent_id
  if (team === 'opponent') return match.challenger_id

  return null
}

export function isParticipant(match: FriendlyMatchRecord, playerId: string): boolean {
  return teamOf(match, playerId) !== null
}

/** True when the player's team won. `winner_id` stores the winning captain. */
export function isWinningTeam(match: FriendlyMatchRecord, playerId: string): boolean {
  if (match.winner_id === null) return false

  const winnerTeam = teamOf(match, match.winner_id)

  return winnerTeam !== null && winnerTeam === teamOf(match, playerId)
}

/** True when the player's team lost a result that already has a winner. */
export function isLosingTeam(match: FriendlyMatchRecord, playerId: string): boolean {
  return (
    match.winner_id !== null && isParticipant(match, playerId) && !isWinningTeam(match, playerId)
  )
}

/** Whether this player has already approved the submitted result. */
export function hasApproved(match: FriendlyMatchRecord, playerId: string): boolean {
  if (match.challenger_id === playerId) return match.challenger_approved_at !== null
  if (match.challenger_partner_id === playerId) return match.challenger_partner_approved_at !== null
  if (match.opponent_id === playerId) return match.opponent_approved_at !== null
  if (match.opponent_partner_id === playerId) return match.opponent_partner_approved_at !== null

  return false
}

/** How many losing-team players have approved; the team size is the target. */
export function losingTeamApprovals(match: FriendlyMatchRecord): number {
  if (match.winner_id === null) return 0

  const winnerTeam = teamOf(match, match.winner_id)
  const losingTeam = winnerTeam === 'challenger' ? 'opponent' : 'challenger'

  if (losingTeam === 'challenger') {
    return (
      (match.challenger_approved_at !== null ? 1 : 0) +
      (match.challenger_partner_approved_at !== null ? 1 : 0)
    )
  }

  return (
    (match.opponent_approved_at !== null ? 1 : 0) +
    (match.opponent_partner_approved_at !== null ? 1 : 0)
  )
}

/** The challenged captain can accept or decline a pending invitation. */
export function canRespond(match: FriendlyMatchRecord, playerId: string): boolean {
  return match.status === 'pending' && match.opponent_id === playerId
}

/** The challenger captain can withdraw before a result exists. */
export function canCancel(match: FriendlyMatchRecord, playerId: string): boolean {
  return (
    match.challenger_id === playerId && (match.status === 'pending' || match.status === 'accepted')
  )
}

/** Either member of the winning team may submit, and only once the challenge was accepted. */
export function canSubmitResult(match: FriendlyMatchRecord, playerId: string): boolean {
  return match.status === 'accepted' && isParticipant(match, playerId)
}

/**
 * Only the losing side approves or disputes; the winner never can. In doubles
 * each losing partner approves once, so a player who already approved stops
 * seeing the action.
 */
export function canReviewResult(match: FriendlyMatchRecord, playerId: string): boolean {
  return (
    match.status === 'awaiting_approval' &&
    isLosingTeam(match, playerId) &&
    !hasApproved(match, playerId)
  )
}

/**
 * Whole hours left before the server confirms the result, or `null` when the
 * match is not awaiting approval. A past deadline reads as `0`.
 */
export function hoursUntilAutoApproval(match: FriendlyMatchRecord, now: number): number | null {
  if (match.status !== 'awaiting_approval' || match.auto_approval_due_at === null) {
    return null
  }

  const due = new Date(match.auto_approval_due_at).getTime()

  if (Number.isNaN(due)) return null

  return Math.max(0, Math.ceil((due - now) / (60 * 60 * 1000)))
}

/** `24` for a freshly submitted result; useful for copy, not for deadlines. */
export function approvalWindowHours(): number {
  return FRIENDLY_APPROVAL_HOURS
}
