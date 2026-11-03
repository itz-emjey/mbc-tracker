import { describe, expect, it } from 'vitest'

import { entryPaymentProgress, paymentSettled } from './payments'
import type { PaymentStatus } from './types'

const rows = (...statuses: PaymentStatus[]) => statuses.map((status) => ({ status }))

describe('paymentSettled', () => {
  it('counts paid and waived as settled, unpaid not', () => {
    expect(paymentSettled('paid')).toBe(true)
    expect(paymentSettled('waived')).toBe(true)
    expect(paymentSettled('unpaid')).toBe(false)
  })
})

describe('entryPaymentProgress', () => {
  it('marks a singles entry eligible when its only row is settled', () => {
    expect(entryPaymentProgress(rows('paid'))).toEqual({
      settled: 1,
      total: 1,
      eligible: true,
    })
    expect(entryPaymentProgress(rows('waived'))).toEqual({
      settled: 1,
      total: 1,
      eligible: true,
    })
  })

  it('keeps a doubles entry ineligible while one participant owes', () => {
    expect(entryPaymentProgress(rows('paid', 'unpaid'))).toEqual({
      settled: 1,
      total: 2,
      eligible: false,
    })
  })

  it('treats a guest partner as a fee row like anyone else', () => {
    expect(entryPaymentProgress(rows('paid', 'waived'))).toEqual({
      settled: 2,
      total: 2,
      eligible: true,
    })
  })

  it('never marks an entry with no fee rows eligible', () => {
    expect(entryPaymentProgress([])).toEqual({
      settled: 0,
      total: 0,
      eligible: false,
    })
  })
})
