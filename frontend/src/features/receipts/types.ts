/**
 * Payment receipt types.
 *
 * These mirror migration 015. A receipt is proof a member sent money; it stays
 * `pending` until module staff accept it, and only then does money move.
 */

import type { Role } from '@/features/auth/types'
import type { PaymentMethod } from '@/features/training/types'

export type ReceiptPurpose = 'training' | 'tournament' | 'jersey'
export type ReceiptStatus = 'pending' | 'approved' | 'rejected'

export const RECEIPT_PURPOSES: readonly ReceiptPurpose[] = ['training', 'tournament', 'jersey']

export const RECEIPT_PURPOSE_LABELS: Record<ReceiptPurpose, string> = {
  training: 'Training fee',
  tournament: 'Tournament entrance fee',
  jersey: 'Jersey order',
}

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** Who may accept or reject a receipt for each purpose. */
export const RECEIPT_REVIEW_ROLES: Record<ReceiptPurpose, readonly Role[]> = {
  training: ['super_admin', 'trainer'],
  tournament: ['super_admin', 'tournament_manager'],
  jersey: ['super_admin', 'trainer'],
}

export function canReviewReceipt(roles: readonly Role[], purpose: ReceiptPurpose): boolean {
  return RECEIPT_REVIEW_ROLES[purpose].some((role) => roles.includes(role))
}

export interface PaymentReceiptRecord {
  id: string
  purpose: ReceiptPurpose
  submitted_by: string
  player_id: string
  fee_period_id: string | null
  entry_payment_id: string | null
  jersey_payment_id: string | null
  /** PostgREST may return `numeric` as a string. */
  amount: string | number
  method: PaymentMethod
  reference_no: string | null
  paid_on: string
  receipt_path: string
  target_label: string
  status: ReceiptStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}
