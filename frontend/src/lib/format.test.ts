import { describe, expect, it } from 'vitest'

import { formatDate, getInitials } from './format'

describe('getInitials', () => {
  it('uses the first and last name', () => {
    expect(getInitials('Maria Santos')).toBe('MS')
  })

  it('handles three or more names', () => {
    expect(getInitials('Juan Miguel Dela Cruz')).toBe('JC')
  })

  it('handles a single name', () => {
    expect(getInitials('Bong')).toBe('B')
  })

  it('collapses extra whitespace', () => {
    expect(getInitials('  ana   reyes  ')).toBe('AR')
  })

  it('falls back to a placeholder for an empty name', () => {
    expect(getInitials('   ')).toBe('?')
  })
})

describe('formatDate', () => {
  it('formats an ISO date without a time-zone shift', () => {
    expect(formatDate('2026-10-31')).toMatch(/2026/)
    expect(formatDate('2026-10-31')).toMatch(/31/)
  })

  it('leaves an invalid value readable instead of printing Invalid Date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})
