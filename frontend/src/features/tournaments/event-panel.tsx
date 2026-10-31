import { Shuffle, UserPlus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { computeRoundRobinStandings } from '@/domain/standings'
import { errorMessage } from '@/features/auth/api'
import type { PlayerRecord } from '@/features/players/types'

import { saveTournamentDraw, withdrawTournamentEntry } from './api'
import { BracketView } from './bracket-view'
import { entryName, matchSideLabel, seedLabel, type EntryLookups } from './display'
import {
  DRAW_ORDER_LABELS,
  DRAW_ORDER_OPTIONS,
  drawPayloadFor,
  orderedEntryIds,
  type DrawOrder,
} from './draw'
import { EntryFormDialog } from './entry-form-dialog'
import { RoundRobinView } from './round-robin-view'
import { ResultFormDialog, type ResultMode } from './result-form-dialog'
import { buildStandingsMatches, groupGamesByMatch } from './results'
import { StandingsTable } from './standings-table'
import {
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  type MatchGameRecord,
  type MatchRecord,
  type TeamMemberRecord,
  type TournamentEntryRecord,
  type TournamentEventRecord,
  type TournamentRecord,
} from './types'

interface EventPanelProps {
  tournament: TournamentRecord
  event: TournamentEventRecord
  entries: readonly TournamentEntryRecord[]
  teamMembers: readonly TeamMemberRecord[]
  matches: readonly MatchRecord[]
  games: readonly MatchGameRecord[]
  players: readonly PlayerRecord[]
  /** Time the page data was loaded; keeps deadline checks out of render. */
  now: number
  onChanged: () => void
}

interface ResultTarget {
  match: MatchRecord
  mode: ResultMode
}

export function EventPanel({
  tournament,
  event,
  entries,
  teamMembers,
  matches,
  games,
  players,
  now,
  onChanged,
}: EventPanelProps) {
  const [entryOpen, setEntryOpen] = React.useState(false)
  const [drawOrder, setDrawOrder] = React.useState<DrawOrder>('seeded')
  const [generating, setGenerating] = React.useState(false)
  const [drawError, setDrawError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ResultTarget | null>(null)

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  const teamMembersByTeam = React.useMemo(() => {
    const grouped = new Map<string, TeamMemberRecord[]>()

    for (const member of teamMembers) {
      const list = grouped.get(member.team_id) ?? []
      list.push(member)
      grouped.set(member.team_id, list)
    }

    return grouped
  }, [teamMembers])

  const lookups: EntryLookups = React.useMemo(
    () => ({ playersById, teamMembersByTeam }),
    [playersById, teamMembersByTeam],
  )

  const eventEntries = React.useMemo(
    () => entries.filter((entry) => entry.event_id === event.id),
    [entries, event.id],
  )

  const registeredEntries = React.useMemo(
    () => eventEntries.filter((entry) => entry.status === 'registered'),
    [eventEntries],
  )

  const entriesById = React.useMemo(
    () => new Map(eventEntries.map((entry) => [entry.id, entry])),
    [eventEntries],
  )

  const eventMatches = React.useMemo(
    () => matches.filter((match) => match.event_id === event.id),
    [matches, event.id],
  )

  const matchesById = React.useMemo(
    () => new Map(eventMatches.map((match) => [match.id, match])),
    [eventMatches],
  )

  const eventGames = React.useMemo(() => {
    const matchIds = new Set(eventMatches.map((match) => match.id))
    return games.filter((game) => matchIds.has(game.match_id))
  }, [eventMatches, games])

  const gamesByMatch = React.useMemo(() => groupGamesByMatch(eventGames), [eventGames])

  const deadlinePassed =
    tournament.status === 'published' &&
    tournament.registration_deadline !== null &&
    new Date(tournament.registration_deadline).getTime() < now

  const drawExists = event.draw_generated_at !== null
  const registrationOpen =
    (tournament.status === 'draft' || tournament.status === 'published') && !deadlinePassed
  const canRegister = registrationOpen && !drawExists
  const canRecord = tournament.status === 'in_progress'

  const completedMatches = eventMatches.filter((match) => match.status === 'completed').length

  const standings = React.useMemo(() => {
    if (event.format !== 'round_robin') return null
    if (registeredEntries.length < 2 || completedMatches === 0) return null

    return computeRoundRobinStandings(
      registeredEntries.map((entry) => entry.id),
      buildStandingsMatches(eventMatches, eventGames),
    )
  }, [event.format, registeredEntries, completedMatches, eventMatches, eventGames])

  async function handleGenerateDraw() {
    setDrawError(null)
    setGenerating(true)

    try {
      const payload = drawPayloadFor(event.format, orderedEntryIds(registeredEntries), drawOrder)
      const outcome = await saveTournamentDraw(event.id, payload)
      toast.success(
        `Draw generated: ${outcome.match_count} match${outcome.match_count === 1 ? '' : 'es'}.`,
      )
      onChanged()
    } catch (generateError) {
      setDrawError(errorMessage(generateError))
    } finally {
      setGenerating(false)
    }
  }

  async function handleWithdraw(entry: TournamentEntryRecord) {
    await withdrawTournamentEntry(entry.id)
    toast.success('Entry withdrawn. The record and its history are kept.')
    onChanged()
  }

  const resultHome = result
    ? matchSideLabel(result.match, 'home', matchesById, entriesById, lookups)
    : ''
  const resultAway = result
    ? matchSideLabel(result.match, 'away', matchesById, entriesById, lookups)
    : ''

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`event-${event.id}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={`event-${event.id}`} className="text-base font-semibold text-text">
            {DISCIPLINE_LABELS[event.discipline]}
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {FORMAT_LABELS[event.format]} · cap {event.max_entries} · {registeredEntries.length}{' '}
            registered
            {drawExists ? ' · draw locked' : ''}
          </p>
        </div>

        {canRegister ? (
          <Button size="sm" className="self-start" onClick={() => setEntryOpen(true)}>
            <UserPlus aria-hidden="true" />
            Add entry
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>
            {drawExists
              ? 'The draw is generated, so entries can no longer be added or withdrawn.'
              : 'Withdrawing keeps the record and frees the cap and seed before the draw.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventEntries.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No entries yet"
              description="Register players or doubles teams for this event."
              action={
                canRegister ? (
                  <Button size="sm" onClick={() => setEntryOpen(true)}>
                    <UserPlus aria-hidden="true" />
                    Add entry
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Seed</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-text-muted">
                      {seedLabel(entry.seed)}
                    </TableCell>
                    <TableCell className="max-w-64 truncate font-medium text-text">
                      {entryName(entry, lookups)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canRegister && entry.status === 'registered' ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm">
                              Withdraw
                            </Button>
                          }
                          title={`Withdraw ${entryName(entry, lookups)}?`}
                          description="The entry stays in history, but it no longer counts toward the cap and its seed becomes available. Withdrawals are only possible before the draw."
                          confirmLabel="Withdraw entry"
                          onConfirm={() => handleWithdraw(entry)}
                        />
                      ) : (
                        <span className="text-xs text-text-faint">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {deadlinePassed && !drawExists ? (
            <p className="mt-3 text-xs text-text-muted">
              The registration deadline has passed. The draw can still be generated.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{drawExists ? 'Draw and results' : 'Draw'}</CardTitle>
          <CardDescription>
            {drawExists
              ? 'Byes advance automatically. Results feed the bracket or the D9 standings.'
              : 'Generate the draw after the entries are final. This locks the entry list.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drawError ? (
            <p role="alert" className="mb-3 text-sm font-medium text-danger">
              {drawError}
            </p>
          ) : null}

          {!drawExists ? (
            registeredEntries.length < 2 ? (
              <p className="text-sm text-text-muted">
                Add at least two registered entries before generating a draw.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div>
                    <label htmlFor={`draw-order-${event.id}`} className="sr-only">
                      Draw order
                    </label>
                    <Select
                      value={drawOrder}
                      onValueChange={(value) => setDrawOrder(value as DrawOrder)}
                    >
                      <SelectTrigger id={`draw-order-${event.id}`} className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DRAW_ORDER_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {DRAW_ORDER_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={() => void handleGenerateDraw()} loading={generating}>
                    <Shuffle aria-hidden="true" />
                    Generate draw
                  </Button>
                </div>

                <p className="text-xs text-text-muted">
                  Seed order places seeded entries first, then registration order. A random draw
                  shuffles the same pool. Byes are not stored as matches; the waiting entry advances
                  to the next round.
                </p>
              </div>
            )
          ) : event.format === 'round_robin' ? (
            <div className="flex flex-col gap-5">
              {standings ? (
                <StandingsTable
                  rows={standings.rows}
                  unresolvedGroups={standings.unresolvedGroups}
                  labelForEntry={(entryId) => entryName(entriesById.get(entryId), lookups)}
                />
              ) : (
                <p className="text-sm text-text-muted">
                  Standings appear after the first completed result.
                </p>
              )}

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                  Match schedule
                </h3>
                <RoundRobinView
                  matches={eventMatches}
                  gamesByMatch={gamesByMatch}
                  entriesById={entriesById}
                  lookups={lookups}
                  canRecord={canRecord}
                  onRecord={(match, mode) => setResult({ match, mode })}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <BracketView
                matches={eventMatches}
                gamesByMatch={gamesByMatch}
                entriesById={entriesById}
                lookups={lookups}
                canRecord={canRecord}
                onRecord={(match, mode) => setResult({ match, mode })}
              />

              {!canRecord && tournament.status !== 'completed' ? (
                <p className="text-xs text-text-muted">Start the tournament to record results.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {entryOpen ? (
        <EntryFormDialog
          key={event.id}
          open={entryOpen}
          event={event}
          players={players}
          entries={entries}
          teamMembers={teamMembers}
          onOpenChange={setEntryOpen}
          onCreated={() => {
            setEntryOpen(false)
            onChanged()
          }}
        />
      ) : null}

      {result ? (
        <ResultFormDialog
          key={`${result.match.id}-${result.mode}`}
          open
          match={result.match}
          homeName={resultHome}
          awayName={resultAway}
          existingGames={gamesByMatch.get(result.match.id) ?? []}
          mode={result.mode}
          onOpenChange={(open) => {
            if (!open) setResult(null)
          }}
          onSaved={() => {
            setResult(null)
            onChanged()
          }}
        />
      ) : null}
    </section>
  )
}
