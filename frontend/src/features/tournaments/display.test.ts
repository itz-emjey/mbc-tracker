import { describe, expect, it } from 'vitest'

import type { PlayerRecord } from '@/features/players/types'

import { entryName, entryPlayerIds, memberLabel, seedLabel, type EntryLookups } from './display'
import type { TeamMemberRecord, TournamentEntryRecord } from './types'

function player(id: string, fullName: string): PlayerRecord {
  return {
    id,
    player_code: `MBC-${id.toUpperCase()}`,
    profile_id: null,
    full_name: fullName,
    gender: null,
    status: 'active',
    rating_status: 'rated',
    joined_on: '2026-01-01',
  }
}

function member(
  overrides: Partial<TeamMemberRecord> & Pick<TeamMemberRecord, 'id' | 'team_id'>,
): TeamMemberRecord {
  return {
    player_id: null,
    guest_name: null,
    guest_gender: null,
    ...overrides,
  }
}

function entry(
  overrides: Partial<TournamentEntryRecord> & Pick<TournamentEntryRecord, 'id'>,
): TournamentEntryRecord {
  return {
    event_id: 'event-1',
    player_id: null,
    team_id: null,
    seed: null,
    status: 'registered',
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const maria = player('maria', 'Maria Santos')
const ana = player('ana', 'Ana Reyes')

const lookups: EntryLookups = {
  playersById: new Map([
    [maria.id, maria],
    [ana.id, ana],
  ]),
  teamMembersByTeam: new Map([
    [
      'team-1',
      [
        member({ id: 'member-1', team_id: 'team-1', player_id: 'maria' }),
        member({
          id: 'member-2',
          team_id: 'team-1',
          guest_name: 'Guest Cruz',
          guest_gender: 'female',
        }),
      ],
    ],
  ]),
}

describe('memberLabel', () => {
  it('returns the linked player name', () => {
    expect(memberLabel(lookups.teamMembersByTeam.get('team-1')![0]!, lookups.playersById)).toBe(
      'Maria Santos',
    )
  })

  it('returns the free-text guest name when there is no player record', () => {
    expect(memberLabel(lookups.teamMembersByTeam.get('team-1')![1]!, lookups.playersById)).toBe(
      'Guest Cruz',
    )
  })
})

describe('entryName', () => {
  it('names a singles entry from the player directory', () => {
    expect(entryName(entry({ id: 'entry-1', player_id: 'maria' }), lookups)).toBe('Maria Santos')
  })

  it('joins a doubles team with its guest partner, sorted by name', () => {
    expect(entryName(entry({ id: 'entry-2', team_id: 'team-1' }), lookups)).toBe(
      'Guest Cruz / Maria Santos',
    )
  })

  it('falls back for unknown or empty entries', () => {
    expect(entryName(null, lookups)).toBe('To be decided')
    expect(entryName(entry({ id: 'entry-3' }), lookups)).toBe('Unknown entry')
    expect(entryName(entry({ id: 'entry-4', team_id: 'missing' }), lookups)).toBe('Unknown team')
  })
})

describe('entryPlayerIds', () => {
  it('returns only real player ids, skipping guests', () => {
    expect(
      entryPlayerIds(entry({ id: 'entry-2', team_id: 'team-1' }), lookups.teamMembersByTeam),
    ).toEqual(['maria'])
  })

  it('returns the singles player id', () => {
    expect(
      entryPlayerIds(entry({ id: 'entry-1', player_id: 'ana' }), lookups.teamMembersByTeam),
    ).toEqual(['ana'])
  })
})

describe('seedLabel', () => {
  it('distinguishes seeded and unseeded entries', () => {
    expect(seedLabel(2)).toBe('Seed 2')
    expect(seedLabel(null)).toBe('Unseeded')
  })
})
