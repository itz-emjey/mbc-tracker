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

export function isOpenFriendly(status: FriendlyStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

/** No further action is possible by either player. */
export function isClosedFriendly(status: FriendlyStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

export function opponentOf(match: FriendlyMatchRecord, playerId: string): string | null {
  if (match.challenger_id === playerId) return match.opponent_id
  if (match.opponent_id === playerId) return match.challenger_id

  return null
}

export function isParticipant(match: FriendlyMatchRecord, playerId: string): boolean {
  return opponentOf(match, playerId) !== null
}

/** The challenged player can accept or decline a pending invitation. */
export function canRespond(match: FriendlyMatchRecord, playerId: string): boolean {
  return match.status === 'pending' && match.opponent_id === playerId
}

/** The challenger can withdraw before a result exists. */
export function canCancel(match: FriendlyMatchRecord, playerId: string): boolean {
  return (
    match.challenger_id === playerId && (match.status === 'pending' || match.status === 'accepted')
  )
}

/** Only the winner may submit, and only once the challenge was accepted. */
export function canSubmitResult(match: FriendlyMatchRecord, playerId: string): boolean {
  return match.status === 'accepted' && isParticipant(match, playerId)
}

/** Only the losing side approves or disputes; the winner never can. */
export function canReviewResult(match: FriendlyMatchRecord, playerId: string): boolean {
  return (
    match.status === 'awaiting_approval' &&
    isParticipant(match, playerId) &&
    match.winner_id !== playerId
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
