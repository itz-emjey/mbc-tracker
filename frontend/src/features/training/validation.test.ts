import { describe, expect, it } from 'vitest'

import { feePeriodFormSchema, paymentFormSchema, sessionFormSchema } from './validation'

const SESSION = {
  title: 'Evening drills',
  starts_at: '2026-11-05T18:00',
  ends_at: '2026-11-05T20:00',
  venue: 'Club courts',
  notes: null,
}

describe('sessionFormSchema', () => {
  it('accepts a session that ends after it starts', () => {
    expect(sessionFormSchema.safeParse(SESSION).success).toBe(true)
  })

  it('rejects a session that ends before it starts', () => {
    const result = sessionFormSchema.safeParse({ ...SESSION, ends_at: '2026-11-05T17:00' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/end after it starts/i)
    }
  })

  it('rejects an unparseable time', () => {
    expect(sessionFormSchema.safeParse({ ...SESSION, starts_at: 'not-a-time' }).success).toBe(false)
  })
})

describe('feePeriodFormSchema', () => {
  it('accepts a normal month', () => {
    const result = feePeriodFormSchema.safeParse({
      label: '2026-11',
      starts_on: '2026-11-01',
      ends_on: '2026-11-30',
      amount: '500.00',
      due_on: '2026-11-10',
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amount).toBe(500)
  })

  it('rejects a zero amount, extra decimals, and reversed dates', () => {
    const base = {
      label: '2026-11',
      starts_on: '2026-11-01',
      ends_on: '2026-11-30',
      amount: '500',
      due_on: null,
    }

    expect(feePeriodFormSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
    expect(feePeriodFormSchema.safeParse({ ...base, amount: '500.001' }).success).toBe(false)
    expect(feePeriodFormSchema.safeParse({ ...base, ends_on: '2026-10-01' }).success).toBe(false)
  })
})

describe('paymentFormSchema', () => {
  it('accepts a partial payment', () => {
    const result = paymentFormSchema.safeParse({
      player_id: 'player-id',
      amount: '250',
      paid_on: '2026-11-08',
      method: 'cash',
    })

    expect(result.success).toBe(true)
  })

  it('rejects a missing player and an unknown method', () => {
    const base = { player_id: 'p', amount: '250', paid_on: '2026-11-08', method: 'cash' }

    expect(paymentFormSchema.safeParse({ ...base, player_id: '' }).success).toBe(false)
    expect(paymentFormSchema.safeParse({ ...base, method: 'barter' }).success).toBe(false)
  })
})
