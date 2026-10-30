import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignores falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('keeps the last conflicting Tailwind class', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('merges conditionally applied classes', () => {
    const isActive = true
    expect(cn('border border-border', isActive && 'border-accent')).toBe('border border-accent')
  })
})
