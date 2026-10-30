import { describe, expect, it } from 'vitest'

import { hasAnyRole } from './types'

describe('hasAnyRole', () => {
  it('allows any approved member when no roles are required', () => {
    expect(hasAnyRole([])).toBe(true)
    expect(hasAnyRole(['player'], [])).toBe(true)
  })

  it('matches a single-role account', () => {
    expect(hasAnyRole(['player'], ['player'])).toBe(true)
    expect(hasAnyRole(['trainer'], ['player'])).toBe(false)
  })

  it('matches when one of several held roles is required', () => {
    const roles = ['tournament_manager', 'trainer'] as const

    expect(hasAnyRole(roles, ['tournament_manager'])).toBe(true)
    expect(hasAnyRole(roles, ['trainer'])).toBe(true)
    expect(hasAnyRole(roles, ['super_admin', 'trainer'])).toBe(true)
  })

  it('rejects when none of the held roles is required', () => {
    expect(hasAnyRole(['player'], ['super_admin', 'trainer'])).toBe(false)
  })

  it('does not imply roles from one another', () => {
    // A Trainer is not an admin; only an explicit assignment grants that.
    expect(hasAnyRole(['trainer'], ['super_admin'])).toBe(false)
    expect(hasAnyRole(['tournament_manager'], ['super_admin'])).toBe(false)
  })
})
