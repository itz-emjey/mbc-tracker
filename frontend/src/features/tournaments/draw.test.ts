import { describe, expect, it } from 'vitest'

import { drawPayloadFor, orderedEntryIds, shuffleEntryIds, type DrawMatchPayload } from './draw'
import type { TournamentEntryRecord } from './types'

function entry(
  id: string,
  seed: number | null,
  overrides: Partial<TournamentEntryRecord> = {},
): TournamentEntryRecord {
  return {
    id,
    event_id: 'event',
    player_id: id,
    team_id: null,
    seed,
    status: 'registered',
    created_by: null,
    created_at: `2026-01-01T00:00:0${id.slice(-1)}Z`,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function assertSourcesComeFirst(matches: readonly DrawMatchPayload[]) {
  const seen = new Set<string>()

  for (const match of matches) {
    for (const source of [match.home_source_key, match.away_source_key]) {
      if (source !== undefined) {
        expect(seen.has(source), `${match.key} refers to later source ${source}`).toBe(true)
      }
    }
    seen.add(match.key)
  }
}

describe('drawPayloadFor', () => {
  it('converts a four-entry single elimination draw in dependency order', () => {
    const payload = drawPayloadFor('single_elimination', ['a', 'b', 'c', 'd'], 'seeded')

    expect(payload).toHaveLength(3)
    expect(payload[0]).toMatchObject({
      key: 'w-r1-m1',
      bracket: 'winners',
      round: 1,
      position: 1,
      home_entry_id: 'a',
      away_entry_id: 'd',
    })
    expect(payload[1]).toMatchObject({
      key: 'w-r1-m2',
      home_entry_id: 'b',
      away_entry_id: 'c',
    })
    expect(payload[2]).toMatchObject({
      key: 'w-r2-m1',
      home_source_key: 'w-r1-m1',
      away_source_key: 'w-r1-m2',
    })

    assertSourcesComeFirst(payload)
  })

  it('leaves byes as missing matches and places every entry once', () => {
    const payload = drawPayloadFor('single_elimination', ['a', 'b', 'c'], 'seeded')

    expect(payload).toHaveLength(2)
    const startingEntries = payload.flatMap((match) =>
      [match.home_entry_id, match.away_entry_id].filter((value): value is string => Boolean(value)),
    )
    expect(new Set(startingEntries)).toEqual(new Set(['a', 'b', 'c']))
    expect(startingEntries).toHaveLength(3)
    assertSourcesComeFirst(payload)
  })

  it('includes the conditional grand-final reset in a double elimination draw', () => {
    const payload = drawPayloadFor('double_elimination', ['a', 'b', 'c', 'd'], 'seeded')

    const final = payload.find((match) => match.key === 'gf')
    const reset = payload.find((match) => match.key === 'gf-reset')

    expect(final).toMatchObject({ bracket: 'grand_final', round: 1 })
    expect(reset).toMatchObject({
      bracket: 'grand_final',
      round: 2,
      conditional: true,
      reset: true,
      home_source_key: 'gf',
      away_source_key: 'gf',
    })

    assertSourcesComeFirst(payload)
  })

  it('stores every round-robin pair exactly once', () => {
    const payload = drawPayloadFor('round_robin', ['a', 'b', 'c', 'd'], 'seeded')

    expect(payload).toHaveLength(6)
    const pairs = payload.map((match) =>
      [match.home_entry_id, match.away_entry_id].sort().join(':'),
    )

    expect(new Set(pairs).size).toBe(6)
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(
        payload.filter((match) => [match.home_entry_id, match.away_entry_id].includes(id)),
      ).toHaveLength(3)
    }
  })

  it('gives every entry a bye-free schedule for odd round robins', () => {
    const payload = drawPayloadFor('round_robin', ['a', 'b', 'c'], 'seeded')

    expect(payload).toHaveLength(3)
    for (const id of ['a', 'b', 'c']) {
      expect(
        payload.filter((match) => [match.home_entry_id, match.away_entry_id].includes(id)),
      ).toHaveLength(2)
    }
  })

  it('shuffles a random draw without losing or duplicating an entry', () => {
    const payload = drawPayloadFor('single_elimination', ['a', 'b', 'c', 'd'], 'random', () => 0)

    const startingEntries = payload.flatMap((match) =>
      [match.home_entry_id, match.away_entry_id].filter((value): value is string => Boolean(value)),
    )

    expect(new Set(startingEntries)).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(startingEntries).toHaveLength(4)
    assertSourcesComeFirst(payload)
  })
})

describe('orderedEntryIds', () => {
  it('puts seeded entries first and keeps unseeded entries in registration order', () => {
    const entries = [
      entry('d', null, { created_at: '2026-01-01T00:00:04Z' }),
      entry('b', 2, { created_at: '2026-01-01T00:00:02Z' }),
      entry('c', null, { created_at: '2026-01-01T00:00:03Z' }),
      entry('a', 1, { created_at: '2026-01-01T00:00:01Z' }),
      entry('x', 3, { status: 'withdrawn' }),
    ]

    expect(orderedEntryIds(entries)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('shuffleEntryIds', () => {
  it('returns a copy and preserves every id', () => {
    const input = ['a', 'b', 'c', 'd']
    const result = shuffleEntryIds(input, () => 0)

    expect(result).not.toBe(input)
    expect([...result].sort()).toEqual([...input].sort())
    expect(input).toEqual(['a', 'b', 'c', 'd'])
  })
})
