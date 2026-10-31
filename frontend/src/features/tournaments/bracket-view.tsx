import * as React from 'react'

import { matchSideLabel, type EntryLookups } from './display'
import { MatchCard } from './match-card'
import type { ResultMode } from './result-form-dialog'
import { groupMatchesByRound } from './results'
import {
  MATCH_BRACKET_LABELS,
  type MatchBracket,
  type MatchGameRecord,
  type MatchRecord,
  type TournamentEntryRecord,
} from './types'

interface BracketViewProps {
  matches: readonly MatchRecord[]
  gamesByMatch: ReadonlyMap<string, readonly MatchGameRecord[]>
  entriesById: ReadonlyMap<string, TournamentEntryRecord>
  lookups: EntryLookups
  canRecord: boolean
  onRecord: (match: MatchRecord, mode: ResultMode) => void
}

const ELIMINATION_BRACKETS: readonly MatchBracket[] = ['winners', 'losers', 'grand_final']

function roundLabel(bracket: MatchBracket, round: number): string {
  if (bracket === 'grand_final') return round === 1 ? 'Grand final' : 'Grand-final reset'
  return `${MATCH_BRACKET_LABELS[bracket]} · round ${round}`
}

export function BracketView({
  matches,
  gamesByMatch,
  entriesById,
  lookups,
  canRecord,
  onRecord,
}: BracketViewProps) {
  const matchesById = React.useMemo(
    () => new Map(matches.map((match) => [match.id, match])),
    [matches],
  )

  const groups = React.useMemo(
    () => groupMatchesByRound(matches.filter((match) => match.bracket !== 'round_robin')),
    [matches],
  )

  if (groups.length === 0) {
    return <p className="text-sm text-text-muted">The draw has no elimination matches yet.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {ELIMINATION_BRACKETS.map((bracket) => {
        const bracketGroups = groups.filter((group) => group.bracket === bracket)
        if (bracketGroups.length === 0) return null

        return (
          <section key={bracket} aria-label={MATCH_BRACKET_LABELS[bracket]}>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
              {MATCH_BRACKET_LABELS[bracket]}
            </h4>

            <div className="flex gap-3 overflow-x-auto pb-2 max-md:block max-md:space-y-3">
              {bracketGroups.map((group) => (
                <div
                  key={`${group.bracket}-${group.round}`}
                  className="min-w-56 flex-1 max-md:min-w-0"
                >
                  <p className="mb-2 text-xs text-text-muted">
                    {roundLabel(group.bracket, group.round)}
                  </p>

                  <div className="flex flex-col gap-2">
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
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
