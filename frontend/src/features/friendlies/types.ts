/**
 * Friendly match types.
 *
 * These mirror migration 010. A confirmed match currently records the result
 * only: no ShuttlePower moves until the win/loss formula is approved.
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
  challenger_id: string
  opponent_id: string
  note: string | null
  status: FriendlyStatus
  winner_id: string | null
  submitted_by: string | null
  submitted_at: string | null
  auto_approval_due_at: string | null
  responded_by: string | null
  responded_at: string | null
  confirmed_at: string | null
  dispute_reason: string | null
  disputed_at: string | null
  created_at: string
}
