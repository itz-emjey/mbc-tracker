export interface StandingsMatch {
  homeEntryId: string
  awayEntryId: string
  homeGames: number
  awayGames: number
  homePoints?: number
  awayPoints?: number
}

export interface StandingsRow {
  entryId: string
  played: number
  wins: number
  losses: number
  gamesWon: number
  gamesLost: number
  gameDifference: number
  pointsWon: number
  pointsLost: number
  pointDifference: number
  position: number
  /** True when every approved tie-break still leaves this group level. */
  playoffRequired: boolean
}

export interface StandingsResult {
  rows: StandingsRow[]
  unresolvedGroups: string[][]
}

interface MutableStandingsRow {
  entryId: string
  played: number
  wins: number
  losses: number
  gamesWon: number
  gamesLost: number
  pointsWon: number
  pointsLost: number
}

interface MiniStats {
  wins: number
  gamesWon: number
  gamesLost: number
  pointsWon: number
  pointsLost: number
}

interface RankedRow {
  entryId: string
  key: number[]
}

function assertMatches(entryIds: readonly string[], matches: readonly StandingsMatch[]): void {
  if (entryIds.length < 2) throw new Error('Standings need at least two entries.')
  if (new Set(entryIds).size !== entryIds.length) throw new Error('Duplicate entry id.')

  const known = new Set(entryIds)
  for (const match of matches) {
    if (match.homeEntryId === match.awayEntryId) {
      throw new Error('An entry cannot play itself.')
    }
    if (!known.has(match.homeEntryId) || !known.has(match.awayEntryId)) {
      throw new Error('A match refers to an entry outside this event.')
    }
    for (const value of [match.homeGames, match.awayGames]) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('Game scores must be non-negative whole numbers.')
      }
    }
    for (const value of [match.homePoints ?? 0, match.awayPoints ?? 0]) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('Point scores must be non-negative whole numbers.')
      }
    }
    if (match.homeGames === match.awayGames) {
      throw new Error('A completed match cannot end level.')
    }
  }
}

function addMatch(
  row: MutableStandingsRow,
  gamesFor: number,
  gamesAgainst: number,
  pointsFor: number,
  pointsAgainst: number,
  won: boolean,
): void {
  row.played += 1
  if (won) row.wins += 1
  else row.losses += 1
  row.gamesWon += gamesFor
  row.gamesLost += gamesAgainst
  row.pointsWon += pointsFor
  row.pointsLost += pointsAgainst
}

function miniTable(
  group: readonly string[],
  matches: readonly StandingsMatch[],
): Map<string, MiniStats> {
  const inGroup = new Set(group)
  const stats = new Map<string, MiniStats>(
    group.map((entryId) => [
      entryId,
      { wins: 0, gamesWon: 0, gamesLost: 0, pointsWon: 0, pointsLost: 0 },
    ]),
  )

  for (const match of matches) {
    if (!inGroup.has(match.homeEntryId) || !inGroup.has(match.awayEntryId)) continue

    const home = stats.get(match.homeEntryId)!
    const away = stats.get(match.awayEntryId)!
    const homePoints = match.homePoints ?? 0
    const awayPoints = match.awayPoints ?? 0
    const homeWon = match.homeGames > match.awayGames

    home.wins += homeWon ? 1 : 0
    away.wins += homeWon ? 0 : 1
    home.gamesWon += match.homeGames
    home.gamesLost += match.awayGames
    away.gamesWon += match.awayGames
    away.gamesLost += match.homeGames
    home.pointsWon += homePoints
    home.pointsLost += awayPoints
    away.pointsWon += awayPoints
    away.pointsLost += homePoints
  }

  return stats
}

function headToHead(
  entryId: string,
  opponentId: string,
  matches: readonly StandingsMatch[],
): number {
  let balance = 0

  for (const match of matches) {
    const isHome = match.homeEntryId === entryId && match.awayEntryId === opponentId
    const isAway = match.awayEntryId === entryId && match.homeEntryId === opponentId
    if (!isHome && !isAway) continue

    const entryWon = isHome ? match.homeGames > match.awayGames : match.awayGames > match.homeGames
    balance += entryWon ? 1 : -1
  }

  return balance
}

function rankKey(
  entryId: string,
  group: readonly string[],
  rows: ReadonlyMap<string, MutableStandingsRow>,
  matches: readonly StandingsMatch[],
): number[] {
  const row = rows.get(entryId)!
  const gameDifference = row.gamesWon - row.gamesLost
  const pointDifference = row.pointsWon - row.pointsLost

  if (group.length === 2) {
    const opponent = group.find((id) => id !== entryId)!
    return [row.wins, headToHead(entryId, opponent, matches), gameDifference, pointDifference]
  }

  // D9: with three or more players level on match wins, the mini-table from
  // their mutual matches replaces head-to-head. Remaining overall differences
  // are a final provisional separator before a playoff is required.
  const mini = miniTable(group, matches).get(entryId)!
  return [
    row.wins,
    mini.wins,
    mini.gamesWon - mini.gamesLost,
    mini.pointsWon - mini.pointsLost,
    gameDifference,
    pointDifference,
  ]
}

function compareKeys(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function sameKey(left: readonly number[], right: readonly number[]): boolean {
  return compareKeys(left, right) === 0
}

/**
 * Compute Round Robin standings from recorded results only. The order is the
 * approved D9 chain: wins, head-to-head (two-way only), the mutual mini-table
 * (three or more), game difference, point difference, then a playoff.
 *
 * The function never invents a winner for an unresolved group: rows in that
 * group share a position and every member carries playoffRequired.
 */
export function computeRoundRobinStandings(
  entryIds: readonly string[],
  matches: readonly StandingsMatch[],
): StandingsResult {
  assertMatches(entryIds, matches)

  const rows = new Map<string, MutableStandingsRow>(
    entryIds.map((entryId) => [
      entryId,
      {
        entryId,
        played: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsWon: 0,
        pointsLost: 0,
      },
    ]),
  )

  for (const match of matches) {
    const home = rows.get(match.homeEntryId)!
    const away = rows.get(match.awayEntryId)!
    const homeWon = match.homeGames > match.awayGames
    addMatch(
      home,
      match.homeGames,
      match.awayGames,
      match.homePoints ?? 0,
      match.awayPoints ?? 0,
      homeWon,
    )
    addMatch(
      away,
      match.awayGames,
      match.homeGames,
      match.awayPoints ?? 0,
      match.homePoints ?? 0,
      !homeWon,
    )
  }

  const winsGroups = new Map<number, string[]>()
  for (const entryId of entryIds) {
    const wins = rows.get(entryId)!.wins
    const group = winsGroups.get(wins) ?? []
    group.push(entryId)
    winsGroups.set(wins, group)
  }

  const ordered: RankedRow[] = []
  const unresolvedGroups: string[][] = []

  for (const wins of [...winsGroups.keys()].sort((left, right) => right - left)) {
    const group = winsGroups.get(wins)!
    const ranked = group
      .map((entryId) => ({ entryId, key: rankKey(entryId, group, rows, matches) }))
      .sort((left, right) => compareKeys(left.key, right.key))

    ordered.push(...ranked)

    let start = 0
    while (start < ranked.length) {
      let end = start + 1
      while (end < ranked.length && sameKey(ranked[start]!.key, ranked[end]!.key)) {
        end += 1
      }

      if (end - start > 1) {
        unresolvedGroups.push(ranked.slice(start, end).map((row) => row.entryId))
      }
      start = end
    }
  }

  const playoff = new Set(unresolvedGroups.flat())
  const result: StandingsRow[] = []

  ordered.forEach((ranked, index) => {
    const row = rows.get(ranked.entryId)!
    const previous = ordered[index - 1]
    const position =
      previous && sameKey(previous.key, ranked.key)
        ? (result[index - 1]?.position ?? index + 1)
        : index + 1

    result.push({
      entryId: row.entryId,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      gamesWon: row.gamesWon,
      gamesLost: row.gamesLost,
      gameDifference: row.gamesWon - row.gamesLost,
      pointsWon: row.pointsWon,
      pointsLost: row.pointsLost,
      pointDifference: row.pointsWon - row.pointsLost,
      position,
      playoffRequired: playoff.has(row.entryId),
    })
  })

  return { rows: result, unresolvedGroups }
}
