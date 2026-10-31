import { describe, expect, it } from 'vitest'

import { formatDate, formatDateRange, formatDateTime, getInitials } from './format'

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

describe('formatDateRange', () => {
  it('shows one date when the tournament starts and ends the same day', () => {
    expect(formatDateRange('2026-10-31', '2026-10-31')).toBe(formatDate('2026-10-31'))
  })

  it('shows both ends otherwise', () => {
    expect(formatDateRange('2026-10-31', '2026-11-02')).toBe(
      `${formatDate('2026-10-31')} – ${formatDate('2026-11-02')}`,
    )
  })
})

describe('formatDateTime', () => {
  it('formats a timestamp and keeps an invalid value readable', () => {
    expect(formatDateTime('2026-10-31T09:30:00Z')).toMatch(/2026/)
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
