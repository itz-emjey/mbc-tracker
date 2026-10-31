import type { PlayerRecord } from '@/features/players/types'

import {
  MATCH_BRACKET_LABELS,
  type MatchRecord,
  type TeamMemberRecord,
  type TournamentEntryRecord,
} from './types'

/**
 * Display helpers shared by the entries table, bracket, and standings.
 * They never decide a result; they only turn stored ids into readable labels.
 */

export interface EntryLookups {
  playersById: ReadonlyMap<string, PlayerRecord>
  teamMembersByTeam: ReadonlyMap<string, readonly TeamMemberRecord[]>
}

export function entryPlayerIds(
  entry: TournamentEntryRecord,
  teamMembersByTeam: ReadonlyMap<string, readonly TeamMemberRecord[]>,
): string[] {
  if (entry.player_id !== null) return [entry.player_id]
  if (entry.team_id === null) return []

  const members = teamMembersByTeam.get(entry.team_id) ?? []
  return members.map((member) => member.player_id)
}

export function entryName(
  entry: TournamentEntryRecord | null | undefined,
  lookups: EntryLookups,
): string {
  if (!entry) return 'To be decided'

  if (entry.player_id !== null) {
    return lookups.playersById.get(entry.player_id)?.full_name ?? 'Unknown player'
  }

  if (entry.team_id === null) return 'Unknown entry'

  const members = lookups.teamMembersByTeam.get(entry.team_id) ?? []
  const names = members
    .map((member) => lookups.playersById.get(member.player_id)?.full_name)
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right))

  return names.length > 0 ? names.join(' / ') : 'Unknown team'
}

export function entryNameForId(
  entryId: string | null,
  entriesById: ReadonlyMap<string, TournamentEntryRecord>,
  lookups: EntryLookups,
): string | null {
  if (entryId === null) return null

  return entryName(entriesById.get(entryId), lookups)
}

export function seedLabel(seed: number | null): string {
  return seed === null ? 'Unseeded' : `Seed ${seed}`
}

function matchCode(match: MatchRecord): string {
  if (match.bracket === 'grand_final') {
    return match.reset ? 'the grand-final reset' : 'the grand final'
  }

  return `${MATCH_BRACKET_LABELS[match.bracket]} round ${match.round} match ${match.position}`
}

/** The entry name, or the source slot while the bracket is still unresolved. */
export function matchSideLabel(
  match: MatchRecord,
  side: 'home' | 'away',
  matchesById: ReadonlyMap<string, MatchRecord>,
  entriesById: ReadonlyMap<string, TournamentEntryRecord>,
  lookups: EntryLookups,
): string {
  const entryId = side === 'home' ? match.home_entry_id : match.away_entry_id
  const fromEntry = entryNameForId(entryId, entriesById, lookups)
  if (fromEntry !== null) return fromEntry

  const sourceId = side === 'home' ? match.home_source_match_id : match.away_source_match_id
  const outcome = side === 'home' ? match.home_source_outcome : match.away_source_outcome

  if (sourceId === null) return 'To be decided'

  const source = matchesById.get(sourceId)
  if (!source || outcome === null) return 'To be decided'

  return `${outcome === 'winner' ? 'Winner' : 'Loser'} of ${matchCode(source)}`
}
