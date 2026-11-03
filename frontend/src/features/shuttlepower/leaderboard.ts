/**
 * Leaderboard ordering.
 *
 * Pure so the rule is testable and identical everywhere it is shown. Ties share
 * a position (competition ranking: 1, 2, 2, 4) and are ordered by name only to
 * keep the display stable — the ranking itself never invents a tie-break.
 *
 * Each row also carries its position inside its display division, so the
 * ladder can show "Champion #2" without a second query. Division positions use
 * the same tie rule as the club position, and every division starts at 1.
 */

import { tierFor, type ArenaTierId } from '@/domain/arena'

export interface LeaderboardRowInput {
  playerId: string
  fullName: string
  sp: number
}

export interface LeaderboardRow extends LeaderboardRowInput {
  /** Position on the whole club ladder. */
  position: number
  /** Display division this balance belongs to. */
  divisionId: ArenaTierId
  /** Position inside that division; ties share a position. */
  divisionPosition: number
}

interface DivisionCounter {
  seen: number
  previousSp: number | null
  position: number
}

export function rankLeaderboard(rows: readonly LeaderboardRowInput[]): LeaderboardRow[] {
  const sorted = [...rows].sort(
    (left, right) =>
      right.sp - left.sp ||
      left.fullName.localeCompare(right.fullName) ||
      left.playerId.localeCompare(right.playerId),
  )

  let position = 0
  let previousSp: number | null = null
  const divisions = new Map<ArenaTierId, DivisionCounter>()

  return sorted.map((row, index) => {
    if (previousSp !== row.sp) {
      position = index + 1
      previousSp = row.sp
    }

    const divisionId = tierFor(row.sp).tier.id
    let counter = divisions.get(divisionId)

    if (!counter) {
      counter = { seen: 0, previousSp: null, position: 1 }
      divisions.set(divisionId, counter)
    }

    if (counter.previousSp !== row.sp) {
      counter.position = counter.seen + 1
      counter.previousSp = row.sp
    }

    counter.seen += 1

    return { ...row, position, divisionId, divisionPosition: counter.position }
  })
}
