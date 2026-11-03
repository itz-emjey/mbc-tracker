import { ArrowLeft, CalendarDays, MapPin, Plus, Swords, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { ArenaStatStrip } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
        kicker="Draw room"
        title={tournament.name}
        description={tournament.description ?? 'Tournament record and official results.'}
        actions={
          events.length > 0 ? (
            <Button asChild variant="secondary" size="sm">
              <Link to={`/tournaments/${tournament.id}/draws`}>
                <Swords aria-hidden="true" />
                Open draw room
              </Link>
            </Button>
          ) : null
        }
      />

      <ArenaStatStrip
        className="mt-4"
        stats={[
          { label: 'Events', value: String(events.length), detail: 'One per discipline' },
          { label: 'Entries', value: String(detail.entries.length), detail: 'Players and teams' },
          {
            label: 'Matches',
            value: String(detail.matches.length),
            detail: 'Scheduled and played',
          },
          {
            label: 'Entry fee',
            value:
              Number(tournament.entrance_fee) === 0 ? 'Free' : formatMoney(tournament.entrance_fee),
            detail: 'Per player',
          },
        ]}
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not refresh this tournament"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
        {posterUrl ? (
          <Card className="overflow-hidden lg:w-72 lg:shrink-0">
            <img
              src={posterUrl}
              alt={`${tournament.name} poster`}
              className="max-h-96 w-full bg-surface-2 object-contain"
            />
          </Card>
        ) : null}

        <Card className="flex-1">
          <CardContent className="flex flex-col gap-5 p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetaItem label="Status">
                <StatusBadge status={tournament.status} />
              </MetaItem>

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
              <div className="border-t border-border pt-4">
                <LifecycleActions tournament={tournament} events={events} onChanged={reload} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <div className="mt-4">
          <TournamentSettings tournament={tournament} onChanged={reload} />
        </div>
      ) : null}

      <section className="mt-6" aria-labelledby="tournament-events-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
              <span aria-hidden="true" className="h-px w-6 bg-accent" />
              Draw room
            </p>
            <h2
              id="tournament-events-heading"
              className="mt-1 text-lg font-semibold tracking-tight text-text"
            >
              Events
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">
              {events.length === 0
                ? 'The disciplines this tournament runs.'
                : `${events.length} event${events.length === 1 ? '' : 's'} · entries and fees here, brackets in the draw room.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 self-start">
            {events.length > 0 ? (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/tournaments/${tournament.id}/draws`}>
                  <Swords aria-hidden="true" />
                  Open draw room
                </Link>
              </Button>
            ) : null}

            {canEditEvents && openEventSlots > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setEventOpen(true)}>
                <Plus aria-hidden="true" />
                Add event
              </Button>
            ) : null}
          </div>
        </div>

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
