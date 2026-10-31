import { describe, expect, it } from 'vitest'

import {
  buildDoubleElimination,
  buildRoundRobinSchedule,
  buildSingleElimination,
  type BracketMatch,
} from './bracket'

function entries(...ids: string[]) {
  return ids.map((id) => ({ id }))
}

function byId(matches: readonly BracketMatch[], id: string): BracketMatch {
  const match = matches.find((candidate) => candidate.id === id)
  if (!match) throw new Error(`Missing match ${id}`)
  return match
}

describe('buildSingleElimination', () => {
  it('uses standard seed pairings for a power-of-two draw', () => {
    const bracket = buildSingleElimination(entries('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'))

    expect(bracket.size).toBe(8)
    expect(bracket.rounds.map((round) => round.name)).toEqual([
      'Quarterfinals',
      'Semifinals',
      'Final',
    ])
    expect(bracket.rounds.map((round) => round.matchIds.length)).toEqual([4, 2, 1])
    expect(bracket.matches).toHaveLength(7)
    expect(bracket.grandFinal).toBeNull()

    const quarterfinals = bracket.matches.filter(
      (match) => match.bracket === 'winners' && match.round === 1,
    )
    expect(quarterfinals.map((match) => [match.home.entryId, match.away.entryId])).toEqual([
      ['A', 'H'],
      ['D', 'E'],
      ['B', 'G'],
      ['C', 'F'],
    ])
    expect(byId(bracket.matches, 'w-r1-m1').winnerTo).toBe('w-r2-m1')
    expect(byId(bracket.matches, 'w-r2-m1').winnerTo).toBe('w-r3-m1')
  })

  it('creates byes as empty slots and advances those entries automatically', () => {
    const bracket = buildSingleElimination(entries('A', 'B', 'C', 'D', 'E'))

    expect(bracket.size).toBe(8)
    expect(bracket.rounds[0]!.matchIds).toEqual([null, 'w-r1-m2', null, null])
    expect(bracket.matches).toHaveLength(4)

    const onlyFirstRoundMatch = byId(bracket.matches, 'w-r1-m2')
    expect([onlyFirstRoundMatch.home.entryId, onlyFirstRoundMatch.away.entryId]).toEqual(['D', 'E'])

    const firstSemifinal = byId(bracket.matches, 'w-r2-m1')
    expect(firstSemifinal.home.entryId).toBe('A')
    expect(firstSemifinal.away.sourceMatchId).toBe('w-r1-m2')

    const secondSemifinal = byId(bracket.matches, 'w-r2-m2')
    expect([secondSemifinal.home.entryId, secondSemifinal.away.entryId]).toEqual(['B', 'C'])

    const final = byId(bracket.matches, 'w-r3-m1')
    expect(final.home.sourceMatchId).toBe('w-r2-m1')
    expect(final.away.sourceMatchId).toBe('w-r2-m2')
  })

  it('builds a two-entry final without a bye match', () => {
    const bracket = buildSingleElimination(entries('A', 'B'))

    expect(bracket.size).toBe(2)
    expect(bracket.rounds).toHaveLength(1)
    expect(bracket.rounds[0]!.name).toBe('Final')
    expect(bracket.matches).toHaveLength(1)
    expect([bracket.matches[0]!.home.entryId, bracket.matches[0]!.away.entryId]).toEqual(['A', 'B'])
  })

  it('rejects an empty draw and duplicate entries', () => {
    expect(() => buildSingleElimination(entries('A'))).toThrow(/at least two/i)
    expect(() => buildSingleElimination(entries('A', 'A'))).toThrow(/duplicate/i)
  })
})

describe('buildDoubleElimination', () => {
  it('creates winners, losers, grand final, and reset links for four entries', () => {
    const bracket = buildDoubleElimination(entries('A', 'B', 'C', 'D'))

    expect(bracket.size).toBe(4)
    expect(
      bracket.rounds.map((round) => [
        round.bracket,
        round.round,
        round.matchIds.filter((id) => id !== null).length,
      ]),
    ).toEqual([
      ['winners', 1, 2],
      ['winners', 2, 1],
      ['losers', 1, 1],
      ['losers', 2, 1],
    ])
    expect(bracket.matches).toHaveLength(7)
    expect(bracket.grandFinal).toEqual({ matchId: 'gf', resetMatchId: 'gf-reset' })

    expect(byId(bracket.matches, 'w-r1-m1').loserTo).toBe('l-r1-m1')
    expect(byId(bracket.matches, 'w-r1-m2').loserTo).toBe('l-r1-m1')
    expect(byId(bracket.matches, 'w-r2-m1').loserTo).toBe('l-r2-m1')
    expect(byId(bracket.matches, 'w-r2-m1').winnerTo).toBe('gf')
    expect(byId(bracket.matches, 'l-r1-m1').winnerTo).toBe('l-r2-m1')
    expect(byId(bracket.matches, 'l-r2-m1').winnerTo).toBe('gf')

    const grandFinal = byId(bracket.matches, 'gf')
    expect(grandFinal.home.sourceMatchId).toBe('w-r2-m1')
    expect(grandFinal.away.sourceMatchId).toBe('l-r2-m1')
    expect(grandFinal.winnerTo).toBeNull()
    expect(grandFinal.conditional).toBe(false)

    const reset = byId(bracket.matches, 'gf-reset')
    expect(reset.conditional).toBe(true)
    expect(reset.reset).toBe(true)
    expect(reset.home.sourceMatchId).toBe('gf')
    expect(reset.away.sourceMatchId).toBe('gf')
  })

  it('builds the full losers ladder for eight entries', () => {
    const bracket = buildDoubleElimination(entries('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'))

    expect(
      bracket.rounds.filter((round) => round.bracket === 'losers').map((round) => round.round),
    ).toEqual([1, 2, 3, 4])
    expect(
      bracket.rounds
        .filter((round) => round.bracket === 'losers')
        .map((round) => round.matchIds.filter((id) => id !== null).length),
    ).toEqual([2, 2, 1, 1])
    expect(bracket.matches).toHaveLength(15)
    expect(new Set(bracket.matches.map((match) => match.id)).size).toBe(15)
  })

  it('handles byes without creating bye matches', () => {
    const bracket = buildDoubleElimination(entries('A', 'B', 'C', 'D', 'E'))

    expect(bracket.size).toBe(8)
    expect(bracket.matches).toHaveLength(9)
    expect(bracket.rounds[0]!.matchIds).toEqual([null, 'w-r1-m2', null, null])
    expect(bracket.grandFinal).not.toBeNull()

    const ids = new Set(bracket.matches.map((match) => match.id))
    for (const match of bracket.matches) {
      if (match.winnerTo !== null) expect(ids.has(match.winnerTo)).toBe(true)
      if (match.loserTo !== null) expect(ids.has(match.loserTo)).toBe(true)
      if (match.home.sourceMatchId !== null) {
        expect(ids.has(match.home.sourceMatchId)).toBe(true)
      }
      if (match.away.sourceMatchId !== null) {
        expect(ids.has(match.away.sourceMatchId)).toBe(true)
      }
    }
  })

  it('builds a two-entry double elimination with a reset placeholder', () => {
    const bracket = buildDoubleElimination(entries('A', 'B'))

    expect(bracket.rounds).toHaveLength(1)
    expect(bracket.matches).toHaveLength(3)
    expect(byId(bracket.matches, 'w-r1-m1').winnerTo).toBe('gf')
    expect(byId(bracket.matches, 'w-r1-m1').loserTo).toBe('gf')
    expect(byId(bracket.matches, 'gf-reset').conditional).toBe(true)
  })
})

describe('buildRoundRobinSchedule', () => {
  it('schedules every pair once for an even draw', () => {
    const schedule = buildRoundRobinSchedule(entries('A', 'B', 'C', 'D'))

    expect(schedule.rounds).toHaveLength(3)
    expect(schedule.rounds.every((round) => round.pairings.length === 2)).toBe(true)
    expect(schedule.rounds.every((round) => round.byeEntryId === null)).toBe(true)

    const pairs = schedule.rounds.flatMap((round) =>
      round.pairings.map((pairing) => [pairing.homeEntryId, pairing.awayEntryId].sort().join('-')),
    )
    expect(pairs.sort()).toEqual(['A-B', 'A-C', 'A-D', 'B-C', 'B-D', 'C-D'])
  })

  it('gives one bye per round for an odd draw', () => {
    const schedule = buildRoundRobinSchedule(entries('A', 'B', 'C', 'D', 'E'))

    expect(schedule.rounds).toHaveLength(5)
    expect(schedule.rounds.every((round) => round.pairings.length === 2)).toBe(true)
    expect(schedule.rounds.every((round) => round.byeEntryId !== null)).toBe(true)
    expect(new Set(schedule.rounds.map((round) => round.byeEntryId)).size).toBe(5)

    const appearances = new Map<string, number>()
    for (const round of schedule.rounds) {
      for (const pairing of round.pairings) {
        appearances.set(pairing.homeEntryId, (appearances.get(pairing.homeEntryId) ?? 0) + 1)
        appearances.set(pairing.awayEntryId, (appearances.get(pairing.awayEntryId) ?? 0) + 1)
      }
    }
    expect([...appearances.values()]).toEqual([4, 4, 4, 4, 4])
  })

  it('rejects duplicate entries', () => {
    expect(() => buildRoundRobinSchedule(entries('A', 'B', 'A'))).toThrow(/duplicate/i)
  })
})
