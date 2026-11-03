import type { PaymentRecord, PaymentStatus } from './types'

/**
 * Entrance-fee eligibility helpers.
 *
 * They mirror the draw rule in migration 014: an entry is eligible only when
 * every participant row is `paid` or `waived`. These functions never change a
 * payment; the database still decides whether the draw may be saved.
 */

/** `true` for statuses that settle a participant's share of the fee. */
export function paymentSettled(status: PaymentStatus): boolean {
  return status === 'paid' || status === 'waived'
}

export interface EntryPaymentProgress {
  /** Rows that are paid or waived. */
  settled: number
  /** Every fee row on the entry, including guests. */
  total: number
  /** No rows yet, or at least one participant still owes. */
  eligible: boolean
}

export function entryPaymentProgress(
  payments: readonly Pick<PaymentRecord, 'status'>[],
): EntryPaymentProgress {
  const settled = payments.filter((payment) => paymentSettled(payment.status)).length

  return {
    settled,
    total: payments.length,
    eligible: payments.length > 0 && settled === payments.length,
  }
}
