import { describe, expect, it } from 'vitest'

import { APP_MODULES, findModule, landingPathFor, modulesFor } from './navigation'
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
      'Arena',
      'Tournaments',
      'ShuttlePower',
      'Friendly Matches',
      'Players',
      'Training',
      'Payments',
      'Jerseys',
      'Polls',
      'Announcements',
    ])
  })

  it('hides staff-only modules from a Player but keeps own-record views', () => {
    const labels = labelsFor(['player'])

    // Tournaments are member-facing: players browse and join published events.
    expect(labels).toContain('Tournaments')
    expect(labels).not.toContain('Administration')
    // A player must be able to see their own attendance and payment records.
    expect(labels).toContain('Training')
    expect(labels).toContain('Payments')
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
    expect(findModule('/')?.label).toBe('Arena')
    expect(findModule('/admin')?.label).toBe('Administration')
    expect(findModule('/admin/registrations')?.label).toBe('Administration')
    expect(findModule('/tournaments/abc')?.label).toBe('Tournaments')
  })

  it('returns nothing for unknown paths', () => {
    expect(findModule('/nope')).toBeUndefined()
  })
})

describe('landingPathFor', () => {
  it('falls back to the overview when no path was remembered', () => {
    expect(landingPathFor(undefined, ['player'])).toBe('/')
  })

  it('keeps a remembered path the account can open', () => {
    expect(landingPathFor('/', ['player'])).toBe('/')
    expect(landingPathFor('/players', ['player'])).toBe('/players')
    expect(landingPathFor('/tournaments', ['tournament_manager'])).toBe('/tournaments')
    expect(landingPathFor('/training', ['player'])).toBe('/training')
    expect(landingPathFor('/admin', ['super_admin'])).toBe('/admin')
  })

  it('drops a remembered path the account cannot open', () => {
    // The reported bug: a Super Admin signs out on /admin, a multi-role member
    // signs in, and the admin path must not be restored.
    expect(landingPathFor('/admin', ['player', 'tournament_manager'])).toBe('/')
    expect(landingPathFor('/admin/registrations', ['player'])).toBe('/')
  })

  it('matches nested paths and keeps query strings', () => {
    expect(landingPathFor('/tournaments/abc?round=2', ['tournament_manager'])).toBe(
      '/tournaments/abc?round=2',
    )
    expect(landingPathFor('/admin?tab=members', ['player'])).toBe('/')
  })

  it('leaves unknown paths alone so the 404 page can render', () => {
    expect(landingPathFor('/nope', ['player'])).toBe('/nope')
  })
})
