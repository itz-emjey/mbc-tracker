import { ArrowLeft, CalendarDays, MapPin, Plus, Swords, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { SectionHeading } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { listPlayers, getPlayerByProfile } from '@/features/players/api'
import { buildFriendEntries, listFriendships } from '@/features/players/friends'
import type { FriendEntry, PlayerRecord } from '@/features/players/types'
import { formatMoney } from '@/features/training/money'
import { getTournamentDetail, tournamentPosterUrl } from '@/features/tournaments/api'
import { EventFormDialog } from '@/features/tournaments/event-form-dialog'
import { EventPanel } from '@/features/tournaments/event-panel'
import { LifecycleActions } from '@/features/tournaments/lifecycle-actions'
import { TournamentSettings } from '@/features/tournaments/tournament-settings'
import {
  DISCIPLINE_LABELS,
  TOURNAMENT_STAFF_ROLES,
  type TournamentDetail,
} from '@/features/tournaments/types'
import { formatDateRange, formatDateTime } from '@/lib/format'

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-faint">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  )
}

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()

  return <TournamentDetailView key={id ?? 'missing'} id={id} />
}

function TournamentDetailView({ id }: { id: string | undefined }) {
  const { user } = useSession()
  const userId = user?.id ?? null
  const [detail, setDetail] = React.useState<TournamentDetail | null>(null)
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [currentPlayer, setCurrentPlayer] = React.useState<PlayerRecord | null>(null)
  const [friends, setFriends] = React.useState<FriendEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [eventOpen, setEventOpen] = React.useState(false)
  /** Captured when the data arrives, so deadline checks stay out of render. */
  const [loadedAt, setLoadedAt] = React.useState(0)

  const canManage = hasAnyRole(user?.roles ?? [], TOURNAMENT_STAFF_ROLES)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    if (!id) return

    void Promise.all([
      getTournamentDetail(id),
      listPlayers(),
      userId ? getPlayerByProfile(userId) : Promise.resolve(null),
      listFriendships(),
    ])
      .then(([nextDetail, nextPlayers, nextPlayer, nextFriendships]) => {
        if (!active) return

        const playersById = new Map(nextPlayers.map((player) => [player.id, player]))

        setDetail(nextDetail)
        setPlayers(nextPlayers)
        setCurrentPlayer(nextPlayer)
        setFriends(
          nextPlayer ? buildFriendEntries(nextFriendships, playersById, nextPlayer.id) : [],
        )
        setLoadedAt(Date.now())
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, reloadKey, userId])

  if (!id) {
    return (
      <>
        <PageHeader title="Tournament" />
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
        <PageHeader title="Tournament" />
        <LoadingState className="mt-6" label="Loading tournament" rows={5} />
      </>
    )
  }

  if (error && !detail) {
    return (
      <>
        <PageHeader title="Tournament" />
        <ErrorState
          className="mt-6"
          title="Could not load this tournament"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  if (!detail) {
    return (
      <>
        <PageHeader title="Tournament" />
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

  const { tournament, events } = detail
  const posterUrl = tournamentPosterUrl(tournament.poster_path)
  const canEditEvents =
    canManage && (tournament.status === 'draft' || tournament.status === 'published')
  const openEventSlots = 4 - events.length
  const drawnEvents = events.filter((event) => event.draw_generated_at !== null).length
  const completedMatches = detail.matches.filter((match) => match.status === 'completed').length

  const registeredByEvent = new Map<string, number>()

  for (const entry of detail.entries) {
    if (entry.status !== 'registered') continue
    registeredByEvent.set(entry.event_id, (registeredByEvent.get(entry.event_id) ?? 0) + 1)
  }

  return (
    <>
      <Link
        to="/tournaments"
        className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-text-muted transition-colors duration-fast hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All tournaments
      </Link>

      <PageHeader
        kicker="Tournament"
        title={tournament.name}
        description={tournament.description ?? 'Tournament record and official results.'}
        stats={[
          { label: 'Events', value: String(events.length) },
          { label: 'Entries', value: String(detail.entries.length) },
          { label: 'Draws', value: `${drawnEvents} / ${events.length}` },
          { label: 'Played', value: `${completedMatches} / ${detail.matches.length}` },
        ]}
        actions={
          <>
            <StatusBadge status={tournament.status} />
            {events.length > 0 ? (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/tournaments/${tournament.id}/draws`}>
                  <Swords aria-hidden="true" />
                  Draw room
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not refresh this tournament"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <section className="mt-5 overflow-hidden rounded-md border border-border bg-surface-1 shadow-panel">
        <div className="flex flex-col sm:flex-row">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={`${tournament.name} poster`}
              className="h-44 w-full border-b border-border bg-surface-2 object-cover sm:h-auto sm:w-48 sm:border-b-0 sm:border-r"
            />
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <dl className="grid flex-1 content-start gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetaItem label="Dates">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-text-faint" aria-hidden="true" />
                  {formatDateRange(tournament.starts_on, tournament.ends_on)}
                </span>
              </MetaItem>

              <MetaItem label="Venue">
                {tournament.venue ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-text-faint" aria-hidden="true" />
                    {tournament.venue}
                  </span>
                ) : (
                  '—'
                )}
              </MetaItem>

              <MetaItem label="Entry fee">
                {Number(tournament.entrance_fee) === 0
                  ? 'Free'
                  : `${formatMoney(tournament.entrance_fee)} per player`}
              </MetaItem>

              <MetaItem label="Registration deadline">
                {tournament.registration_deadline
                  ? formatDateTime(tournament.registration_deadline)
                  : 'Not set'}
              </MetaItem>
            </dl>

            {canManage ? (
              <div className="border-t border-border px-4 py-3">
                <LifecycleActions tournament={tournament} events={events} onChanged={reload} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {canManage ? (
        <div className="mt-4">
          <TournamentSettings tournament={tournament} onChanged={reload} />
        </div>
      ) : null}

      <section className="mt-8" aria-label="Events">
        <SectionHeading
          index="01"
          title="Events"
          description={
            events.length === 0
              ? 'Add the disciplines this tournament runs, then bring in entries.'
              : `${events.length} event${
                  events.length === 1 ? '' : 's'
                } · each one runs Entries, Draw, then Results in place.`
          }
          action={
            canEditEvents && openEventSlots > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setEventOpen(true)}>
                <Plus aria-hidden="true" />
                Add event
              </Button>
            ) : null
          }
        />

        {canEditEvents && openEventSlots === 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            All four disciplines are already added to this tournament.
          </p>
        ) : null}

        <div className="mt-4">
          {events.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No events yet"
              description={
                canEditEvents
                  ? 'Add Singles, doubles, or Mixed Doubles. Each discipline can appear once.'
                  : 'This tournament has no events yet.'
              }
              action={
                canEditEvents ? (
                  <Button onClick={() => setEventOpen(true)}>
                    <Plus aria-hidden="true" />
                    Add event
                  </Button>
                ) : null
              }
            />
          ) : (
            <Tabs defaultValue={events[0]?.id}>
              <TabsList className="w-full max-w-full overflow-x-auto">
                {events.map((event) => (
                  <TabsTrigger key={event.id} value={event.id}>
                    {DISCIPLINE_LABELS[event.discipline]}
                    <span className="rounded-pill border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-text-muted">
                      {registeredByEvent.get(event.id) ?? 0}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {events.map((event) => (
                <TabsContent key={event.id} value={event.id}>
                  <EventPanel
                    tournament={tournament}
                    event={event}
                    entries={detail.entries}
                    teamMembers={detail.teamMembers}
                    payments={detail.payments}
                    invitations={detail.invitations}
                    matches={detail.matches}
                    games={detail.games}
                    players={players}
                    friends={friends}
                    currentPlayer={currentPlayer}
                    canManage={canManage}
                    now={loadedAt}
                    onChanged={reload}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </section>

      {eventOpen ? (
        <EventFormDialog
          key={events.map((event) => event.discipline).join('|')}
          open
          tournamentId={tournament.id}
          usedDisciplines={events.map((event) => event.discipline)}
          onOpenChange={setEventOpen}
          onCreated={() => {
            setEventOpen(false)
            reload()
          }}
        />
      ) : null}
    </>
  )
}
