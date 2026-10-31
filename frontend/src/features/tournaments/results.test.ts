import { describe, expect, it } from 'vitest'

import {
  buildStandingsMatches,
  formatGameScores,
  groupGamesByMatch,
  groupMatchesByRound,
} from './results'
import type { MatchGameRecord, MatchRecord } from './types'

function match(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'match',
    event_id: 'event',
    bracket: 'winners',
    round: 1,
    position: 1,
    home_entry_id: 'home',
    away_entry_id: 'away',
    home_source_match_id: null,
    away_source_match_id: null,
    home_source_outcome: null,
    away_source_outcome: null,
    winner_entry_id: null,
    status: 'pending',
    conditional: false,
    reset: false,
    recorded_by: null,
    recorded_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function game(
  matchId: string,
  gameNumber: number,
  homePoints: number,
  awayPoints: number,
): MatchGameRecord {
  return {
    match_id: matchId,
    game_number: gameNumber,
    home_points: homePoints,
    away_points: awayPoints,
  }
}

describe('buildStandingsMatches', () => {
  it('counts games and points from completed matches only', () => {
    const matches = [
      match({ id: 'played', status: 'completed', winner_entry_id: 'home' }),
      match({ id: 'pending' }),
      match({ id: 'cancelled', status: 'cancelled' }),
      match({ id: 'half', status: 'completed', away_entry_id: null }),
    ]

    const games = [
      game('played', 1, 21, 15),
      game('played', 2, 19, 21),
      game('played', 3, 21, 12),
      game('pending', 1, 21, 10),
      game('cancelled', 1, 21, 10),
    ]

    expect(buildStandingsMatches(matches, games)).toEqual([
      {
        homeEntryId: 'home',
        awayEntryId: 'away',
        homeGames: 2,
        awayGames: 1,
        homePoints: 61,
        awayPoints: 48,
      },
    ])
  })
})

describe('formatGameScores', () => {
  it('orders games by game number', () => {
    const games = [game('m', 2, 19, 21), game('m', 1, 21, 15), game('m', 3, 21, 12)]

    expect(formatGameScores(games)).toBe('21–15, 19–21, 21–12')
    expect(formatGameScores([])).toBe('')
  })
})

describe('groupGamesByMatch', () => {
  it('groups and orders each match’s games', () => {
    const grouped = groupGamesByMatch([
      game('b', 2, 21, 10),
      game('a', 2, 18, 21),
      game('b', 1, 21, 12),
      game('a', 1, 21, 16),
    ])

    expect(grouped.get('a')?.map((item) => item.game_number)).toEqual([1, 2])
    expect(grouped.get('b')?.map((item) => item.game_number)).toEqual([1, 2])
  })
})

describe('groupMatchesByRound', () => {
  it('groups by bracket and round in display order', () => {
    const groups = groupMatchesByRound([
      match({ id: 'gf', bracket: 'grand_final', round: 1, position: 1 }),
      match({ id: 'l1', bracket: 'losers', round: 1, position: 2 }),
      match({ id: 'w2', bracket: 'winners', round: 2, position: 1 }),
      match({ id: 'l1a', bracket: 'losers', round: 1, position: 1 }),
      match({ id: 'w1', bracket: 'winners', round: 1, position: 1 }),
    ])

    expect(groups.map((group) => `${group.bracket}:${group.round}`)).toEqual([
      'winners:1',
      'winners:2',
      'losers:1',
      'grand_final:1',
    ])
    expect(groups[2]?.matches.map((item) => item.id)).toEqual(['l1a', 'l1'])
  })
})
