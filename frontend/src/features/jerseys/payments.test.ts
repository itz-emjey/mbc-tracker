import { describe, expect, it } from 'vitest'

import { paymentsByOrder, summarizeJerseyPayments } from './payments'
import type { JerseyOrderPaymentRecord, JerseyPaymentStatus } from './types'

function payment(
  orderId: string,
  amount: string | number,
  status: JerseyPaymentStatus,
): JerseyOrderPaymentRecord {
  return {
    id: `payment-${orderId}`,
    order_id: orderId,
    player_id: `player-${orderId}`,
    amount,
    status,
    marked_by: status === 'unpaid' ? null : 'profile-1',
    marked_at: status === 'unpaid' ? null : '2026-11-01T00:00:00.000Z',
    note: null,
    created_at: '2026-10-30T00:00:00.000Z',
    updated_at: '2026-10-30T00:00:00.000Z',
  }
}

describe('paymentsByOrder', () => {
  it('keys each fee row by its order', () => {
    const rows = paymentsByOrder([payment('order-a', '1200.00', 'paid')])

    expect(rows.get('order-a')?.status).toBe('paid')
    expect(rows.get('order-b')).toBeUndefined()
  })
})

describe('summarizeJerseyPayments', () => {
  it('separates collected, waived, and outstanding money', () => {
    const summary = summarizeJerseyPayments([
      payment('a', '1200.00', 'paid'),
      payment('b', 1200, 'unpaid'),
      payment('c', '1200.00', 'waived'),
    ])

    expect(summary).toEqual({
      total: 3,
      settled: 2,
      totalAmount: 3600,
      paidAmount: 1200,
      waivedAmount: 1200,
      outstandingAmount: 1200,
    })
  })

  it('rounds accumulated centavos once', () => {
    const summary = summarizeJerseyPayments([
      payment('a', '0.10', 'unpaid'),
      payment('b', 0.2, 'unpaid'),
    ])

    expect(summary.outstandingAmount).toBe(0.3)
  })

  it('is empty when no fee rows are visible', () => {
    expect(summarizeJerseyPayments([])).toEqual({
      total: 0,
      settled: 0,
      totalAmount: 0,
      paidAmount: 0,
      waivedAmount: 0,
      outstandingAmount: 0,
    })
  })
})
