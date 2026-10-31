import { describe, expect, it } from 'vitest'

import { registrationSchema, rejectReasonSchema, signInSchema } from './validation'

describe('signInSchema', () => {
  it('accepts and normalises an email', () => {
    const parsed = signInSchema.parse({
      email: '  Alex@Example.Test ',
      password: 'secret',
    })

    expect(parsed.email).toBe('alex@example.test')
  })

  it('rejects an invalid email and an empty password', () => {
    const parsed = signInSchema.safeParse({ email: 'not-an-email', password: '' })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.email).toBeDefined()
      expect(parsed.error.flatten().fieldErrors.password).toBeDefined()
    }
  })
})

describe('registrationSchema', () => {
  const base = {
    fullName: '  Bea Pending  ',
    email: 'BEA@example.test',
    password: 'long-enough',
    confirmPassword: 'long-enough',
  }

  it('trims the name and lowercases the email', () => {
    const parsed = registrationSchema.parse(base)

    expect(parsed.fullName).toBe('Bea Pending')
    expect(parsed.email).toBe('bea@example.test')
  })

  it('rejects mismatched passwords', () => {
    const parsed = registrationSchema.safeParse({
      ...base,
      confirmPassword: 'different-password',
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.confirmPassword).toContain('Passwords do not match')
    }
  })

  it('rejects a short password and an overlong name', () => {
    const parsed = registrationSchema.safeParse({
      ...base,
      fullName: 'x'.repeat(121),
      password: 'short',
      confirmPassword: 'short',
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors
      expect(errors.fullName).toBeDefined()
      expect(errors.password).toBeDefined()
    }
  })
})

describe('rejectReasonSchema', () => {
  it('requires a short explanation', () => {
    expect(rejectReasonSchema.safeParse('   ').success).toBe(false)
    expect(rejectReasonSchema.parse('  Name does not match the roster.  ')).toBe(
      'Name does not match the roster.',
    )
  })
})
