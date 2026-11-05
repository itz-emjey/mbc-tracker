/**
 * Friendly match types.
 *
 * These mirror migrations 010, 017, and 020. A confirmed match awards
 * ShuttlePower under the enabled approved rule. Doubles has two players per
 * team and per-partner approval state.
 */

export type FriendlyStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'awaiting_approval'
  | 'confirmed'
  | 'auto_approved'
  | 'disputed'

export type FriendlyMatchType = 'singles' | 'doubles'

export const FRIENDLY_STATUS_LABELS: Record<FriendlyStatus, string> = {
  pending: 'Awaiting reply',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  awaiting_approval: 'Awaiting approval',
  confirmed: 'Confirmed',
  auto_approved: 'Auto-approved',
  disputed: 'Disputed',
}

/** Club rule: the losing player has 24 hours to approve or dispute. */
export const FRIENDLY_APPROVAL_HOURS = 24

export interface FriendlyMatchRecord {
  id: string
  match_type: FriendlyMatchType
  challenger_id: string
  challenger_partner_id: string | null
  opponent_id: string
  opponent_partner_id: string | null
  note: string | null
  status: FriendlyStatus
  winner_id: string | null
  submitted_by: string | null
  submitted_at: string | null
  auto_approval_due_at: string | null
  responded_by: string | null
  responded_at: string | null
  confirmed_at: string | null
  challenger_approved_at: string | null
  challenger_partner_approved_at: string | null
  opponent_approved_at: string | null
  opponent_partner_approved_at: string | null
  dispute_reason: string | null
  disputed_at: string | null
  created_at: string
}
