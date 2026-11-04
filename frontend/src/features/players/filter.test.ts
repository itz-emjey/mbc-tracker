import { describe, expect, it } from 'vitest'

import { visiblePlayers } from './filter'
import type { PlayerRecord } from './types'

function player(
  id: string,
  full_name: string,
  status: PlayerRecord['status'],
  joined_on: string,
): PlayerRecord {
  return {
    id,
    player_code: `MBC-${id.padStart(8, '0')}`,
    profile_id: null,
    full_name,
    gender: null,
    status,
    rating_status: 'rated',
    joined_on,
  }
}

const roster: PlayerRecord[] = [
  player('1', 'Zara Lim', 'suspended', '2026-01-05'),
  player('2', 'ana Reyes', 'active', '2026-03-10'),
  player('3', 'Bong Cruz', 'inactive', '2025-12-31'),
  player('4', 'Ana Santos', 'active', '2026-02-01'),
]

describe('visiblePlayers', () => {
  it('searches names case-insensitively and trims the query', () => {
    const result = visiblePlayers(roster, { query: '  ANA ', status: 'all', sort: 'name' })

    expect(result.map((row) => row.id)).toEqual(['2', '4'])
  })

  it('filters by status', () => {
    const result = visiblePlayers(roster, { query: '', status: 'active', sort: 'name' })

    expect(result.map((row) => row.id)).toEqual(['2', '4'])
  })

  it('combines a search with a status filter', () => {
    const result = visiblePlayers(roster, { query: 'ana', status: 'inactive', sort: 'name' })

    expect(result).toEqual([])
  })

  it('sorts by name, newest joined, or status order', () => {
    expect(
      visiblePlayers(roster, { query: '', status: 'all', sort: 'name' }).map(
        (row) => row.full_name,
      ),
    ).toEqual(['ana Reyes', 'Ana Santos', 'Bong Cruz', 'Zara Lim'])

    expect(
      visiblePlayers(roster, { query: '', status: 'all', sort: 'joined' }).map((row) => row.id),
    ).toEqual(['2', '4', '1', '3'])

    expect(
      visiblePlayers(roster, { query: '', status: 'all', sort: 'status' }).map((row) => row.id),
    ).toEqual(['2', '4', '3', '1'])
  })

  it('does not mutate the caller’s array', () => {
    const snapshot = roster.map((row) => row.id)

    visiblePlayers(roster, { query: '', status: 'all', sort: 'joined' })

    expect(roster.map((row) => row.id)).toEqual(snapshot)
  })
})
