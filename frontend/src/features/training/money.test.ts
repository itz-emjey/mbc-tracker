import { describe, expect, it } from 'vitest'

import {
  attendedCount,
  countAttendance,
  formatMoney,
  paymentState,
  remainingAmount,
  roundMoney,
  sumRecorded,
  toAmount,
} from './money'

describe('money helpers', () => {
  it('parses numeric strings and rejects junk as zero', () => {
    expect(toAmount('1200.50')).toBe(1200.5)
    expect(toAmount(40)).toBe(40)
    expect(toAmount('not-a-number')).toBe(0)
  })

  it('rounds to centavos without float drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(
      sumRecorded([
        { amount: '100.10', status: 'recorded' },
        { amount: 0.2, status: 'recorded' },
      ]),
    ).toBe(100.3)
  })

  it('excludes voided payments from totals', () => {
    expect(
      sumRecorded([
        { amount: '500.00', status: 'recorded' },
        { amount: '500.00', status: 'voided' },
      ]),
    ).toBe(500)
  })

  it('derives unpaid, partial, and paid states', () => {
    expect(paymentState('1000.00', 0)).toBe('unpaid')
    expect(paymentState('1000.00', '400.00')).toBe('partial')
    expect(paymentState('1000.00', '1000.00')).toBe('paid')
    expect(paymentState('1000.00', '1200.00')).toBe('paid')
  })

  it('reports the remaining balance without going negative', () => {
    expect(remainingAmount('1000.00', '250.00')).toBe(750)
    expect(remainingAmount('1000.00', '1200.00')).toBe(0)
  })

  it('formats peso amounts', () => {
    expect(formatMoney('1200')).toMatch(/1,200\.00/)
  })
})

describe('attendance helpers', () => {
  it('counts each status and treats present or late as attended', () => {
    const counts = countAttendance([
      { status: 'present' },
      { status: 'present' },
      { status: 'late' },
      { status: 'absent' },
      { status: 'excused' },
    ])

    expect(counts).toEqual({ present: 2, late: 1, absent: 1, excused: 1, total: 5 })
    expect(attendedCount(counts)).toBe(3)
  })

  it('ignores an unknown status in the attended count', () => {
    const counts = countAttendance([{ status: 'present' }, { status: 'unknown' }])

    expect(counts.total).toBe(2)
    expect(attendedCount(counts)).toBe(1)
  })
})
