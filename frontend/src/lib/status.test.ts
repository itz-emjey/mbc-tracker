import { describe, expect, it } from 'vitest'

import { isKnownStatus, statusLabel, statusTone } from './status'

describe('statusTone', () => {
  it('maps known statuses to their tone', () => {
    expect(statusTone('pending')).toBe('warning')
    expect(statusTone('confirmed')).toBe('accent')
    expect(statusTone('unpaid')).toBe('danger')
    expect(statusTone('auto-approved')).toBe('info')
    expect(statusTone('archived')).toBe('neutral')
  })

  it('falls back to neutral for unknown statuses', () => {
    expect(statusTone('something-new')).toBe('neutral')
    expect(statusTone('')).toBe('neutral')
  })
})

describe('statusLabel', () => {
  it('capitalises and humanises the value', () => {
    expect(statusLabel('pending')).toBe('Pending')
    expect(statusLabel('auto-approved')).toBe('Auto-approved')
  })

  it('returns an empty string for empty input', () => {
    expect(statusLabel('')).toBe('')
  })
})

describe('isKnownStatus', () => {
  it('guards the union', () => {
    expect(isKnownStatus('paid')).toBe(true)
    expect(isKnownStatus('paid-ish')).toBe(false)
  })
})
