/**
 * Jersey fee summaries.
 *
 * One fee row exists per order, but a page may hold orders whose row has not
 * arrived yet, so lookups stay tolerant. Amounts are rounded to centavos before
 * they are shown or compared; the database still owns the real balance.
 */

import { roundMoney, toAmount } from '@/features/training/money'

import type { JerseyOrderPaymentRecord } from './types'

export function paymentsByOrder(
  payments: readonly JerseyOrderPaymentRecord[],
): Map<string, JerseyOrderPaymentRecord> {
  return new Map(payments.map((payment) => [payment.order_id, payment]))
}

export interface JerseyPaymentSummary {
  /** Orders with a visible fee row. */
  total: number
  /** Paid or waived orders. */
  settled: number
  totalAmount: number
  paidAmount: number
  waivedAmount: number
  outstandingAmount: number
}

export function summarizeJerseyPayments(
  payments: readonly JerseyOrderPaymentRecord[],
): JerseyPaymentSummary {
  let total = 0
  let settled = 0
  let totalAmount = 0
  let paidAmount = 0
  let waivedAmount = 0
  let outstandingAmount = 0

  for (const payment of payments) {
    const amount = toAmount(payment.amount)

    total += 1
    totalAmount += amount

    if (payment.status === 'paid') {
      settled += 1
      paidAmount += amount
    } else if (payment.status === 'waived') {
      settled += 1
      waivedAmount += amount
    } else {
      outstandingAmount += amount
    }
  }

  return {
    total,
    settled,
    totalAmount: roundMoney(totalAmount),
    paidAmount: roundMoney(paidAmount),
    waivedAmount: roundMoney(waivedAmount),
    outstandingAmount: roundMoney(outstandingAmount),
  }
}
