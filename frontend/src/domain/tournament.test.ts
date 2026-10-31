import { describe, expect, it } from 'vitest'

import {
  playersPerEntry,
  validateTournamentEntries,
  type EntryValidationResult,
  type TournamentPlayer,
} from './tournament'

const players: TournamentPlayer[] = [
  { id: 'ana', gender: 'female' },
  { id: 'bea', gender: 'female' },
  { id: 'carlo', gender: 'male' },
  { id: 'dino', gender: 'male' },
  { id: 'unknown-gender', gender: null },
]

function codes(result: EntryValidationResult): string[] {
  return result.valid ? [] : result.errors.map((error) => error.code)
}

describe('validateTournamentEntries', () => {
  it('accepts singles and enforces one player per entry', () => {
    expect(
      validateTournamentEntries({
        discipline: 'singles',
        entries: [{ playerIds: ['ana'] }, { playerIds: ['carlo'] }],
        players,
      }),
    ).toEqual({ valid: true, errors: [] })

    const result = validateTournamentEntries({
      discipline: 'singles',
      entries: [{ playerIds: ['ana', 'bea'] }],
      players,
    })
    expect(codes(result)).toContain('invalid_participant_count')
  })

  it('accepts valid gendered doubles and mixed doubles pairs', () => {
    expect(
      validateTournamentEntries({
        discipline: 'mens_doubles',
        entries: [{ playerIds: ['carlo', 'dino'] }],
        players,
      }).valid,
    ).toBe(true)

    expect(
      validateTournamentEntries({
        discipline: 'womens_doubles',
        entries: [{ playerIds: ['ana', 'bea'] }],
        players,
      }).valid,
    ).toBe(true)

    expect(
      validateTournamentEntries({
        discipline: 'mixed_doubles',
        entries: [{ playerIds: ['ana', 'carlo'] }],
        players,
      }).valid,
    ).toBe(true)
  })

  it('enforces the D10 mixed doubles pairing and recorded genders', () => {
    const sameGender = validateTournamentEntries({
      discipline: 'mixed_doubles',
      entries: [{ playerIds: ['ana', 'bea'] }],
      players,
    })
    expect(codes(sameGender)).toContain('mixed_doubles_pairing')

    const missingGender = validateTournamentEntries({
      discipline: 'mixed_doubles',
      entries: [{ playerIds: ['ana', 'unknown-gender'] }],
      players,
    })
    expect(codes(missingGender)).toContain('gender_required')

    const wrongGender = validateTournamentEntries({
      discipline: 'mens_doubles',
      entries: [{ playerIds: ['carlo', 'ana'] }],
      players,
    })
    expect(codes(wrongGender)).toContain('doubles_gender_mismatch')
  })

  it('rejects duplicate players within an entry and across the event', () => {
    const withinEntry = validateTournamentEntries({
      discipline: 'mixed_doubles',
      entries: [{ playerIds: ['ana', 'ana'] }],
      players,
    })
    expect(codes(withinEntry)).toContain('duplicate_player')

    const acrossEntries = validateTournamentEntries({
      discipline: 'singles',
      entries: [{ playerIds: ['ana'] }, { playerIds: ['ana'] }],
      players,
    })
    expect(codes(acrossEntries)).toContain('duplicate_player')
  })

  it('validates the cap, seeds, and missing players', () => {
    const result = validateTournamentEntries({
      discipline: 'singles',
      maxEntries: 1,
      entries: [
        { playerIds: ['ana'], seed: 1 },
        { playerIds: ['bea'], seed: 1 },
        { playerIds: ['missing'], seed: 0 },
      ],
      players,
    })

    expect(result.valid).toBe(false)
    expect(codes(result)).toEqual([
      'too_many_entries',
      'duplicate_seed',
      'player_not_found',
      'invalid_seed',
    ])
  })

  it('allows an unseeded draw', () => {
    const result = validateTournamentEntries({
      discipline: 'singles',
      maxEntries: 8,
      entries: [{ playerIds: ['ana'] }, { playerIds: ['bea'], seed: null }],
      players,
    })

    expect(result.valid).toBe(true)
  })

  it('reports the number of players per entry', () => {
    expect(playersPerEntry('singles')).toBe(1)
    expect(playersPerEntry('mixed_doubles')).toBe(2)
  })
})
