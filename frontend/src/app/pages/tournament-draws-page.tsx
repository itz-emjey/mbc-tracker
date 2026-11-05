import { ArrowLeft, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { listPlayers } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import { getTournamentDetail } from '@/features/tournaments/api'
import type { EntryLookups } from '@/features/tournaments/display'
import { EventDraw } from '@/features/tournaments/event-draw'
import {
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  TOURNAMENT_STAFF_ROLES,
  type TeamMemberRecord,
  type TournamentDetail,
  type TournamentEntryRecord,
} from '@/features/tournaments/types'
import { cn } from '@/lib/cn'
import { formatDateRange } from '@/lib/format'

/**
 * The draw room: every event of one tournament, one board at a time.
 * The selected event lives in the URL (`?event=`), so a bracket can be linked
 * or refreshed without losing the place.
 */
export function TournamentDrawsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()

  const [detail, setDetail] = React.useState<TournamentDetail | null>(null)
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  const canManage = hasAnyRole(user?.roles ?? [], TOURNAMENT_STAFF_ROLES)

  React.useEffect(() => {
    let active = true

    if (!id) return

    const tournamentId: string = id

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextDetail, nextPlayers] = await Promise.all([
          getTournamentDetail(tournamentId),
          listPlayers(),
        ])

        if (!active) return

        setDetail(nextDetail)
        setPlayers(nextPlayers)
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [id, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  const teamMembersByTeam = React.useMemo(() => {
    const grouped = new Map<string, TeamMemberRecord[]>()

    for (const member of detail?.teamMembers ?? []) {
      const list = grouped.get(member.team_id) ?? []
      list.push(member)
      grouped.set(member.team_id, list)
    }

    return grouped
  }, [detail])

  const lookups: EntryLookups = React.useMemo(
    () => ({ playersById, teamMembersByTeam }),
    [playersById, teamMembersByTeam],
  )

  const entriesById = React.useMemo(
    () => new Map((detail?.entries ?? []).map((entry) => [entry.id, entry])),
    [detail],
  )

  const entriesByEvent = React.useMemo(() => {
    const grouped = new Map<string, TournamentEntryRecord[]>()

    for (const entry of detail?.entries ?? []) {
      const list = grouped.get(entry.event_id) ?? []
      list.push(entry)
      grouped.set(entry.event_id, list)
    }

    return grouped
  }, [detail])

  const events = detail?.events ?? []
  const requested = searchParams.get('event')
  const selected = events.find((event) => event.id === requested) ?? events[0] ?? null

  function selectEvent(eventId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('event', eventId)
    setSearchParams(next)
  }

  if (!id) {
    return (
      <>
        <PageHeader kicker="Draw room" title="Tournament" />
        <EmptyState
          className="mt-6"
          icon={Trophy}
          title="Tournament not found"
          description="This link is missing a tournament id."
          action={
            <Button variant="secondary" asChild>
              <Link to="/tournaments">Back to tournaments</Link>
            </Button>
          }
        />
      </>
    )
  }

  if (loading && !detail) {
    return (
      <>
        <PageHeader kicker="Draw room" title="Tournament" />
        <LoadingState className="mt-6" label="Loading the draw room" rows={5} />
      </>
    )
  }

  if (error && !detail) {
    return (
      <>
        <PageHeader kicker="Draw room" title="Tournament" />
        <ErrorState
          className="mt-6"
          title="Could not load this draw room"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  if (!detail) {
    return (
      <>
        <PageHeader kicker="Draw room" title="Tournament" />
        <EmptyState
          className="mt-6"
          icon={Trophy}
          title="Tournament not found"
          description="This tournament may have been removed, or the link is out of date."
          action={
            <Button variant="secondary" asChild>
              <Link to="/tournaments">Back to tournaments</Link>
            </Button>
          }
        />
      </>
    )
  }

  const { tournament } = detail
  const registeredCount = (detail.entries ?? []).filter(
    (entry) => entry.status === 'registered',
  ).length
  const playedCount = detail.matches.filter((match) => match.status === 'completed').length
  const drawnEvents = events.filter((event) => event.draw_generated_at !== null).length

  return (
    <>
      <Link
        to={`/tournaments/${tournament.id}`}
        className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-text-muted transition-colors duration-fast hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to {tournament.name}
      </Link>

      <PageHeader
        kicker="Draw room"
        title={tournament.name}
        description={`${formatDateRange(tournament.starts_on, tournament.ends_on)}${
          tournament.venue ? ` · ${tournament.venue}` : ''
        } · Pick an event to follow its bracket or schedule.`}
        stats={[
          { label: 'Events', value: String(events.length) },
          { label: 'Registered', value: String(registeredCount) },
          { label: 'Draws', value: `${drawnEvents} / ${events.length}` },
          { label: 'Played', value: `${playedCount} / ${detail.matches.length}` },
        ]}
        actions={<StatusBadge status={tournament.status} />}
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not refresh the draw room"
          description={error}
          onRetry={reload}
        />
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={Trophy}
          title="No events to draw"
          description={
            canManage
              ? 'Add an event to this tournament first; its bracket appears here once the draw is generated.'
              : 'Tournament staff have not added an event yet.'
          }
          action={
            <Button variant="secondary" asChild>
              <Link to={`/tournaments/${tournament.id}`}>Back to tournament</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div
            className="mt-5 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Events in this tournament"
          >
            {events.map((event) => {
              const active = selected?.id === event.id
              const entries = entriesByEvent.get(event.id) ?? []
              const registered = entries.filter((entry) => entry.status === 'registered').length
              const drawn = event.draw_generated_at !== null

              return (
                <button
                  key={event.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectEvent(event.id)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2',
                  )}
                >
                  <span className={cn('text-sm font-medium', active ? 'text-accent' : 'text-text')}>
                    {DISCIPLINE_LABELS[event.discipline]}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-faint">
                    {FORMAT_LABELS[event.format]} · {registered} entr
                    {registered === 1 ? 'y' : 'ies'} · {drawn ? 'draw locked' : 'no draw'}
                  </span>
                </button>
              )
            })}
          </div>

          {selected ? (
            <div className="mt-4">
              <EventDraw
                tournament={tournament}
                event={selected}
                entries={entriesByEvent.get(selected.id) ?? []}
                matches={detail.matches.filter((match) => match.event_id === selected.id)}
                games={detail.games.filter((game) =>
                  detail.matches.some(
                    (match) => match.id === game.match_id && match.event_id === selected.id,
                  ),
                )}
                entriesById={entriesById}
                lookups={lookups}
                canManage={canManage}
                canRecord={tournament.status === 'in_progress'}
                onChanged={reload}
              />
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
