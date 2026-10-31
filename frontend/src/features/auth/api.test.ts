import { describe, expect, it } from 'vitest'

import { accountStatusFromDatabase, accountStatusLabel, errorMessage, isRole } from './api'

describe('account status mapping', () => {
  it('maps the database status vocabulary to the UI', () => {
    expect(accountStatusFromDatabase('active')).toBe('approved')
    expect(accountStatusFromDatabase('pending')).toBe('pending')
    expect(accountStatusFromDatabase('suspended')).toBe('suspended')
    expect(accountStatusFromDatabase('deactivated')).toBe('deactivated')
  })

  it('rejects unknown status values', () => {
    expect(() => accountStatusFromDatabase('archived')).toThrow(/Unknown account status/)
  })

  it('has a readable label for every UI status', () => {
    expect(accountStatusLabel('approved')).toBe('Approved')
    expect(accountStatusLabel('deactivated')).toBe('Deactivated')
  })
})

describe('role keys', () => {
  it('accepts the fixed role catalogue only', () => {
    expect(isRole('player')).toBe(true)
    expect(isRole('super_admin')).toBe(true)
    expect(isRole('admin')).toBe(false)
  })
})

describe('errorMessage', () => {
  it('keeps useful server messages and rewrites common auth failures', () => {
    expect(errorMessage(new Error('Invalid login credentials'))).toBe(
      'Email or password is incorrect.',
    )
    expect(errorMessage(new Error('not authorized'))).toBe(
      'Only an active Super Admin can do that.',
    )
  })

  it('falls back for an unknown error', () => {
    expect(errorMessage(null)).toMatch(/something went wrong/i)
  })
})
