import { describe, expect, it } from 'vitest'

import { rankLeaderboard } from './leaderboard'

describe('rankLeaderboard', () => {
  it('orders by SP and then by name', () => {
    const rows = rankLeaderboard([
      { playerId: 'p1', fullName: 'Bea', sp: 1100 },
      { playerId: 'p2', fullName: 'Ari', sp: 1300 },
      { playerId: 'p3', fullName: 'Cal', sp: 900 },
    ])

    expect(rows.map((row) => row.fullName)).toEqual(['Ari', 'Bea', 'Cal'])
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3])
  })

  it('gives equal SP the same position and skips the next one', () => {
    const rows = rankLeaderboard([
      { playerId: 'p1', fullName: 'Bea', sp: 1200 },
      { playerId: 'p2', fullName: 'Ari', sp: 1200 },
      { playerId: 'p3', fullName: 'Cal', sp: 1000 },
    ])

    expect(rows.map((row) => row.position)).toEqual([1, 1, 3])
  })

  it('returns an empty list for an empty leaderboard', () => {
    expect(rankLeaderboard([])).toEqual([])
  })
})
