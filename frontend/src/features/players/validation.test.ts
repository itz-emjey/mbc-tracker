import { describe, expect, it } from 'vitest'

import { isIsoDate, playerFormSchema } from './validation'

const valid = {
  full_name: 'Maria Santos',
  gender: 'female' as const,
  status: 'active' as const,
  joined_on: '2026-10-31',
}

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-10-31')).toBe(true)
    expect(isIsoDate('2024-02-29')).toBe(true)
  })

  it('rejects impossible or malformed dates', () => {
    expect(isIsoDate('2025-02-29')).toBe(false)
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('31-10-2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('playerFormSchema', () => {
  it('accepts a complete record and trims the name', () => {
    const result = playerFormSchema.safeParse({ ...valid, full_name: '  Maria Santos  ' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.full_name).toBe('Maria Santos')
    }
  })

  it('accepts an unrecorded gender', () => {
    expect(playerFormSchema.safeParse({ ...valid, gender: null }).success).toBe(true)
  })

  it('rejects a blank or overlong name', () => {
    expect(playerFormSchema.safeParse({ ...valid, full_name: '   ' }).success).toBe(false)
    expect(playerFormSchema.safeParse({ ...valid, full_name: 'a'.repeat(121) }).success).toBe(false)
  })

  it('rejects values outside the fixed vocabularies', () => {
    expect(playerFormSchema.safeParse({ ...valid, gender: 'other' }).success).toBe(false)
    expect(playerFormSchema.safeParse({ ...valid, status: 'retired' }).success).toBe(false)
  })

  it('rejects an invalid joining date', () => {
    expect(playerFormSchema.safeParse({ ...valid, joined_on: '2026-02-31' }).success).toBe(false)
  })
})
