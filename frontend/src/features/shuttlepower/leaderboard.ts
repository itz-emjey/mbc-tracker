/**
 * Leaderboard ordering.
 *
 * Pure so the rule is testable and identical everywhere it is shown. Ties share
 * a position (competition ranking: 1, 2, 2, 4) and are ordered by name only to
 * keep the display stable — the ranking itself never invents a tie-break.
 */

export interface LeaderboardRowInput {
  playerId: string
  fullName: string
  sp: number
}

export interface LeaderboardRow extends LeaderboardRowInput {
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

  return sorted.map((row, index) => {
    if (previousSp !== row.sp) {
      position = index + 1
      previousSp = row.sp
    }

    return { ...row, position }
  })
}
