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
  return `Round ${round}`
}

function matchCount(count: number): string {
  return `${count} match${count === 1 ? '' : 'es'}`
}

/**
 * The draw, read left to right.
 *
 * Each round is a column of clash cards; on small screens the columns stack so
 * the bracket stays usable without horizontal scrolling.
 */
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
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
        The draw has no elimination matches yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {ELIMINATION_BRACKETS.map((bracket) => {
        const bracketGroups = groups.filter((group) => group.bracket === bracket)
        if (bracketGroups.length === 0) return null

        const totalMatches = bracketGroups.reduce((sum, group) => sum + group.matches.length, 0)

        return (
          <section key={bracket} aria-label={MATCH_BRACKET_LABELS[bracket]}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-text">
                <span aria-hidden="true" className="h-px w-5 bg-accent" />
                {MATCH_BRACKET_LABELS[bracket]}
              </h4>
              <span className="font-mono text-[10px] tabular-nums text-text-faint">
                {matchCount(totalMatches)}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 max-md:flex-col">
              {bracketGroups.map((group) => (
                <div
                  key={`${group.bracket}-${group.round}`}
                  className="min-w-56 flex-1 rounded-md border border-border bg-surface-2 p-2 max-md:min-w-0"
                >
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      {roundLabel(group.bracket, group.round)}
                    </p>
                    <span className="font-mono text-[10px] tabular-nums text-text-faint">
                      {group.matches.length}
                    </span>
                  </div>

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
