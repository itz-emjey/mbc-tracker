import * as React from 'react'

import { matchSideLabel, type EntryLookups } from './display'
import { MatchCard } from './match-card'
import type { ResultMode } from './result-form-dialog'
import { groupMatchesByRound } from './results'
import type { MatchGameRecord, MatchRecord, TournamentEntryRecord } from './types'

interface RoundRobinViewProps {
  matches: readonly MatchRecord[]
  gamesByMatch: ReadonlyMap<string, readonly MatchGameRecord[]>
  entriesById: ReadonlyMap<string, TournamentEntryRecord>
  lookups: EntryLookups
  canRecord: boolean
  onRecord: (match: MatchRecord, mode: ResultMode) => void
}

export function RoundRobinView({
  matches,
  gamesByMatch,
  entriesById,
  lookups,
  canRecord,
  onRecord,
}: RoundRobinViewProps) {
  const matchesById = React.useMemo(
    () => new Map(matches.map((match) => [match.id, match])),
    [matches],
  )

  const groups = React.useMemo(
    () => groupMatchesByRound(matches.filter((match) => match.bracket === 'round_robin')),
    [matches],
  )

  if (groups.length === 0) {
    return <p className="text-sm text-text-muted">The schedule has no matches yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={`rr-${group.round}`} aria-label={`Round ${group.round}`}>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
            Round {group.round}
          </h4>

          <div className="grid gap-2 sm:grid-cols-2">
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                homeName={matchSideLabel(match, 'home', matchesById, entriesById, lookups)}
                awayName={matchSideLabel(match, 'away', matchesById, entriesById, lookups)}
                games={gamesByMatch.get(match.id) ?? []}
                canRecord={canRecord}
                onRecord={onRecord}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
