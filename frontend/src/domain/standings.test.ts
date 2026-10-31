import { describe, expect, it } from 'vitest'

import { computeRoundRobinStandings, type StandingsMatch } from './standings'

function match(
  homeEntryId: string,
  awayEntryId: string,
  homeGames: number,
  awayGames: number,
  homePoints = 0,
  awayPoints = 0,
): StandingsMatch {
  return { homeEntryId, awayEntryId, homeGames, awayGames, homePoints, awayPoints }
}

describe('computeRoundRobinStandings', () => {
  it('orders a clean result by match wins and totals the stats', () => {
    const result = computeRoundRobinStandings(
      ['A', 'B', 'C'],
      [match('A', 'B', 2, 0), match('A', 'C', 2, 1), match('B', 'C', 2, 0)],
    )

    expect(result.rows.map((row) => [row.entryId, row.wins, row.position])).toEqual([
      ['A', 2, 1],
      ['B', 1, 2],
      ['C', 0, 3],
    ])
    expect(result.rows[0]).toMatchObject({
      played: 2,
      wins: 2,
      losses: 0,
      gamesWon: 4,
      gamesLost: 1,
      gameDifference: 3,
      playoffRequired: false,
    })
    expect(result.unresolvedGroups).toEqual([])
  })

  it('breaks a two-way tie with their head-to-head result', () => {
    const result = computeRoundRobinStandings(
      ['A', 'B', 'C', 'D'],
      [
        match('A', 'B', 2, 0, 42, 20),
        match('A', 'C', 2, 1, 50, 40),
        match('D', 'A', 2, 0, 42, 0),
        match('B', 'C', 2, 0, 42, 0),
        match('B', 'D', 2, 0, 42, 0),
        match('C', 'D', 2, 1, 45, 40),
      ],
    )

    expect(result.rows.slice(0, 2).map((row) => row.entryId)).toEqual(['A', 'B'])
    expect(result.rows[0]!.wins).toBe(2)
    expect(result.rows[1]!.wins).toBe(2)
    expect(result.rows[0]!.gameDifference).toBeLessThan(result.rows[1]!.gameDifference)
    expect(result.rows[0]!.position).toBe(1)
    expect(result.rows[1]!.position).toBe(2)
    expect(result.rows[0]!.playoffRequired).toBe(false)
  })

  it('uses the mutual mini-table when three players split head-to-head', () => {
    const result = computeRoundRobinStandings(
      ['A', 'B', 'C'],
      [
        match('A', 'B', 21, 5, 42, 10),
        match('B', 'C', 21, 19, 42, 38),
        match('C', 'A', 21, 20, 42, 40),
      ],
    )

    // Every player has one win: head-to-head is circular and skipped, so the
    // mini-table's game difference orders A > C > B.
    expect(result.rows.map((row) => row.entryId)).toEqual(['A', 'C', 'B'])
    expect(result.rows.map((row) => row.wins)).toEqual([1, 1, 1])
    expect(result.rows.every((row) => row.playoffRequired === false)).toBe(true)
    expect(result.unresolvedGroups).toEqual([])
  })

  it('requires a playoff when a circular group ties on every criterion', () => {
    const result = computeRoundRobinStandings(
      ['A', 'B', 'C'],
      [
        match('A', 'B', 21, 19, 40, 38),
        match('B', 'C', 21, 19, 40, 38),
        match('C', 'A', 21, 19, 40, 38),
      ],
    )

    expect(result.rows.map((row) => row.entryId)).toEqual(['A', 'B', 'C'])
    expect(result.rows.map((row) => row.position)).toEqual([1, 1, 1])
    expect(result.rows.every((row) => row.playoffRequired)).toBe(true)
    expect(result.unresolvedGroups).toEqual([['A', 'B', 'C']])
  })

  it('uses point difference after games are level', () => {
    const result = computeRoundRobinStandings(
      ['A', 'B', 'C'],
      [
        match('A', 'B', 21, 19, 40, 30),
        match('B', 'C', 21, 19, 40, 10),
        match('C', 'A', 21, 19, 42, 40),
      ],
    )

    expect(result.rows.map((row) => row.entryId)).toEqual(['B', 'A', 'C'])
    expect(result.rows.every((row) => row.playoffRequired === false)).toBe(true)
  })

  it('rejects unknown entries, self-matches, and drawn results', () => {
    expect(() => computeRoundRobinStandings(['A'], [])).toThrow(/at least two/i)
    expect(() => computeRoundRobinStandings(['A', 'A'], [])).toThrow(/duplicate/i)
    expect(() => computeRoundRobinStandings(['A', 'B'], [match('A', 'C', 2, 0)])).toThrow(
      /outside/i,
    )
    expect(() => computeRoundRobinStandings(['A', 'B'], [match('A', 'A', 2, 0)])).toThrow(/itself/i)
    expect(() => computeRoundRobinStandings(['A', 'B'], [match('A', 'B', 2, 2)])).toThrow(
      /cannot end level/i,
    )
  })
})
