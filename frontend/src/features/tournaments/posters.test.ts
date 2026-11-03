import { describe, expect, it } from 'vitest'

import {
  TOURNAMENT_POSTER_MAX_BYTES,
  buildTournamentPosterPath,
  validateTournamentPoster,
} from './posters'

const file = (overrides: Partial<{ type: string; size: number }> = {}) => ({
  name: 'poster.png',
  type: 'image/png',
  size: 1024,
  ...overrides,
})

describe('validateTournamentPoster', () => {
  it('accepts PNG, JPEG, and WebP images', () => {
    expect(validateTournamentPoster(file())).toBeNull()
    expect(validateTournamentPoster(file({ type: 'image/jpeg' }))).toBeNull()
    expect(validateTournamentPoster(file({ type: 'image/webp' }))).toBeNull()
  })

  it('refuses other file types by MIME rather than by name', () => {
    expect(
      validateTournamentPoster({ name: 'poster.png', type: 'application/pdf', size: 1024 }),
    ).toMatch(/PNG, JPEG, or WebP/)
    expect(
      validateTournamentPoster({ name: 'poster.svg', type: 'image/svg+xml', size: 1024 }),
    ).toMatch(/PNG, JPEG, or WebP/)
  })

  it('refuses empty and oversized files', () => {
    expect(validateTournamentPoster(file({ size: 0 }))).toMatch(/empty/i)
    expect(validateTournamentPoster(file({ size: TOURNAMENT_POSTER_MAX_BYTES + 1 }))).toMatch(
      /5 MB/,
    )
    expect(validateTournamentPoster(file({ size: TOURNAMENT_POSTER_MAX_BYTES }))).toBeNull()
  })
})

describe('buildTournamentPosterPath', () => {
  const tournamentId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  const imageId = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

  it('lays the object out as posters/tournament/image', () => {
    expect(buildTournamentPosterPath(tournamentId, imageId, 'image/png')).toBe(
      `posters/${tournamentId}/${imageId}.png`,
    )
    expect(buildTournamentPosterPath(tournamentId, imageId, 'image/jpeg')).toBe(
      `posters/${tournamentId}/${imageId}.jpg`,
    )
    expect(buildTournamentPosterPath(tournamentId, imageId, 'image/webp')).toBe(
      `posters/${tournamentId}/${imageId}.webp`,
    )
  })

  it('refuses unsupported types and malformed ids', () => {
    expect(() => buildTournamentPosterPath(tournamentId, imageId, 'image/gif')).toThrow(
      /Unsupported/,
    )
    expect(() => buildTournamentPosterPath('not-a-uuid', imageId, 'image/png')).toThrow(
      /tournament id/,
    )
    expect(() => buildTournamentPosterPath(tournamentId, '../escape', 'image/png')).toThrow(
      /image id/,
    )
  })
})
