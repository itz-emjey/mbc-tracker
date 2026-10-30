import { describe, expect, it } from 'vitest'

import { getInitials } from './format'

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
