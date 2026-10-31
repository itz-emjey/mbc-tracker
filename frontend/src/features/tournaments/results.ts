import type { StandingsMatch } from '@/domain/standings'

import type { MatchBracket, MatchGameRecord, MatchRecord } from './types'

/** Games grouped per match and ordered by game number. */
export function groupGamesByMatch(
  games: readonly MatchGameRecord[],
): Map<string, MatchGameRecord[]> {
  const grouped = new Map<string, MatchGameRecord[]>()

  for (const game of games) {
    const list = grouped.get(game.match_id) ?? []
    list.push(game)
    grouped.set(game.match_id, list)
  }

  for (const list of grouped.values()) {
    list.sort((left, right) => left.game_number - right.game_number)
  }

  return grouped
}

/**
 * D9 input from stored results. Only completed matches with both sides decided
 * contribute; a cancelled grand-final reset is not a played match.
 */
export function buildStandingsMatches(
  matches: readonly MatchRecord[],
  games: readonly MatchGameRecord[],
): StandingsMatch[] {
  const grouped = groupGamesByMatch(games)
  const standings: StandingsMatch[] = []

  for (const match of matches) {
    if (match.status !== 'completed') continue
    if (match.home_entry_id === null || match.away_entry_id === null) continue

    const matchGames = grouped.get(match.id) ?? []
    let homeGames = 0
    let awayGames = 0
    let homePoints = 0
    let awayPoints = 0

    for (const game of matchGames) {
      if (game.home_points > game.away_points) homeGames += 1
      else awayGames += 1

      homePoints += game.home_points
      awayPoints += game.away_points
    }

    standings.push({
      homeEntryId: match.home_entry_id,
      awayEntryId: match.away_entry_id,
      homeGames,
      awayGames,
      homePoints,
      awayPoints,
    })
  }

  return standings
}

/** `"21–15, 19–21, 21–12"`; an empty string when no games are stored. */
export function formatGameScores(games: readonly MatchGameRecord[]): string {
  return [...games]
    .sort((left, right) => left.game_number - right.game_number)
    .map((game) => `${game.home_points}–${game.away_points}`)
    .join(', ')
}

const BRACKET_ORDER: Record<MatchBracket, number> = {
  winners: 0,
  losers: 1,
  grand_final: 2,
  round_robin: 3,
}

export interface MatchRoundGroup {
  bracket: MatchBracket
  round: number
  matches: MatchRecord[]
}

/** One group per bracket round, in display order. */
export function groupMatchesByRound(matches: readonly MatchRecord[]): MatchRoundGroup[] {
  const groups = new Map<string, MatchRoundGroup>()

  for (const match of matches) {
    const key = `${match.bracket}:${match.round}`
    const group = groups.get(key) ?? {
      bracket: match.bracket,
      round: match.round,
      matches: [],
    }

    group.matches.push(match)
    groups.set(key, group)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      matches: [...group.matches].sort((left, right) => left.position - right.position),
    }))
    .sort((left, right) => {
      const bracket = BRACKET_ORDER[left.bracket] - BRACKET_ORDER[right.bracket]
      return bracket !== 0 ? bracket : left.round - right.round
    })
}
