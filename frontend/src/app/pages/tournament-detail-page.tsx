import { ArrowLeft, CalendarDays, MapPin, Plus, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/features/auth/api'
import { listPlayers } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import { getTournamentDetail } from '@/features/tournaments/api'
import { EventFormDialog } from '@/features/tournaments/event-form-dialog'
import { EventPanel } from '@/features/tournaments/event-panel'
import { LifecycleActions } from '@/features/tournaments/lifecycle-actions'
import { DISCIPLINE_LABELS, type TournamentDetail } from '@/features/tournaments/types'
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
  const [detail, setDetail] = React.useState<TournamentDetail | null>(null)
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [eventOpen, setEventOpen] = React.useState(false)
  /** Captured when the data arrives, so deadline checks stay out of render. */
  const [loadedAt, setLoadedAt] = React.useState(0)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    if (!id) return

    void Promise.all([getTournamentDetail(id), listPlayers()])
      .then(([nextDetail, nextPlayers]) => {
        if (!active) return

        setDetail(nextDetail)
        setPlayers(nextPlayers)
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
  }, [id, reloadKey])

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
  const canEditEvents = tournament.status === 'draft' || tournament.status === 'published'
  const openEventSlots = 4 - events.length

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
        title={tournament.name}
        description={tournament.description ?? 'Tournament record and official results.'}
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not refresh this tournament"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <Card className="mt-5">
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

            <MetaItem label="Registration deadline">
              {tournament.registration_deadline
                ? formatDateTime(tournament.registration_deadline)
                : 'Not set'}
            </MetaItem>
          </dl>

          <div className="border-t border-border pt-4">
            <LifecycleActions tournament={tournament} events={events} onChanged={reload} />
          </div>
        </CardContent>
      </Card>

      <section className="mt-6" aria-labelledby="tournament-events-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="tournament-events-heading"
              className="text-base font-semibold tracking-tight text-text"
            >
              Events
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">
              {events.length === 0
                ? 'Add the disciplines this tournament runs.'
                : `${events.length} event${events.length === 1 ? '' : 's'} · one per discipline.`}
            </p>
          </div>

          {canEditEvents && openEventSlots > 0 ? (
            <Button variant="secondary" className="self-start" onClick={() => setEventOpen(true)}>
              <Plus aria-hidden="true" />
              Add event
            </Button>
          ) : null}
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
                  : 'This tournament has no events.'
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
              <TabsList className="max-w-full overflow-x-auto">
                {events.map((event) => (
                  <TabsTrigger key={event.id} value={event.id}>
                    {DISCIPLINE_LABELS[event.discipline]}
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
                    matches={detail.matches}
                    games={detail.games}
                    players={players}
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
