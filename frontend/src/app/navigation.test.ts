import { describe, expect, it } from 'vitest'

import { APP_MODULES, findModule, modulesFor } from './navigation'
import type { Role } from '@/features/auth/types'

const labelsFor = (roles: Role[]): string[] => modulesFor(roles).map((module) => module.label)

describe('navigation config', () => {
  it('has a unique path per module', () => {
    const paths = APP_MODULES.map((module) => module.path)

    expect(new Set(paths).size).toBe(paths.length)
  })

  it('keeps every module reachable by the Super Admin role', () => {
    expect(modulesFor(['super_admin'])).toHaveLength(APP_MODULES.length)
  })

  it('gives a Player the member-facing modules only', () => {
    expect(labelsFor(['player'])).toEqual([
      'Overview',
      'ShuttlePower',
      'Friendly Matches',
      'Players',
      'Jerseys',
      'Polls',
      'Announcements',
    ])
  })

  it('hides tournament, training, payment, and admin modules from a Player', () => {
    const labels = labelsFor(['player'])

    expect(labels).not.toContain('Tournaments')
    expect(labels).not.toContain('Training')
    expect(labels).not.toContain('Payments')
    expect(labels).not.toContain('Administration')
  })

  it('unions the permissions of a multi-role account', () => {
    const labels = labelsFor(['tournament_manager', 'trainer'])

    expect(labels).toContain('Tournaments')
    expect(labels).toContain('Training')
    expect(labels).toContain('Payments')
    expect(labels).not.toContain('Administration')
  })

  it('shows the Super Admin module to admins only', () => {
    expect(labelsFor(['super_admin'])).toContain('Administration')
    expect(labelsFor(['tournament_manager', 'trainer'])).not.toContain('Administration')
  })

  it('resolves nested paths to their owning module', () => {
    expect(findModule('/')?.label).toBe('Overview')
    expect(findModule('/admin')?.label).toBe('Administration')
    expect(findModule('/admin/registrations')?.label).toBe('Administration')
    expect(findModule('/tournaments/abc')?.label).toBe('Tournaments')
  })

  it('returns nothing for unknown paths', () => {
    expect(findModule('/nope')).toBeUndefined()
  })
})
