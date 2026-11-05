import { CalendarDays, MapPin, Plus, SearchX, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ProgressTrack, SectionHeading } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/features/auth/api'
import { hasAnyRole } from '@/features/auth/types'
import { useSession } from '@/features/auth/session-context'
import { daysBetween } from '@/domain/arena'
import { listTournamentProgress, listTournaments } from '@/features/tournaments/api'
import { TournamentFormDialog } from '@/features/tournaments/tournament-form-dialog'
import {
  TOURNAMENT_STAFF_ROLES,
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_LABELS,
  type TournamentProgress,
  type TournamentRecord,
  type TournamentStatus,
} from '@/features/tournaments/types'
import { formatMoney } from '@/features/training/money'
import { cn } from '@/lib/cn'
import { formatDateRange, formatDateTime } from '@/lib/format'

type StatusFilter = 'all' | TournamentStatus

const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...TOURNAMENT_STATUSES]

/** Local calendar date, matching how the club reads date-only fields. */
function localToday(): string {
  const date = new Date()

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

/** One line that says where the board stands, in the club's own words. */
function progressText(progress: TournamentProgress): string {
  if (progress.events === 0) return 'No events yet'

  const draws = `${progress.drawnEvents}/${progress.events} draws`

  if (progress.matches === 0) return draws

  return `${draws} · ${progress.playedMatches}/${progress.matches} played`
}

function dateBlock(value: string): { day: string; month: string } {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return { day: '--', month: '---' }

  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date).toUpperCase(),
  }
}

export function TournamentsPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = React.useState<TournamentRecord[]>([])
  const [progress, setProgress] = React.useState<ReadonlyMap<string, TournamentProgress>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [formOpen, setFormOpen] = React.useState(false)

  const canManage = hasAnyRole(user?.roles ?? [], TOURNAMENT_STAFF_ROLES)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    async function load() {
      try {
        const nextTournaments = await listTournaments()
        const nextProgress = await listTournamentProgress(
          nextTournaments.map((tournament) => tournament.id),
        )

        if (!active) return

        setTournaments(nextTournaments)
        setProgress(nextProgress)
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
  }, [reloadKey])

  const today = localToday()
  const filtered = React.useMemo(
    () =>
      status === 'all'
        ? tournaments
        : tournaments.filter((tournament) => tournament.status === status),
    [tournaments, status],
  )

  const live = tournaments.filter((tournament) => tournament.status === 'in_progress').length
  const published = tournaments.filter((tournament) => tournament.status === 'published').length
  const drafts = tournaments.filter((tournament) => tournament.status === 'draft').length

  function countFor(option: StatusFilter): number {
    return option === 'all'
      ? tournaments.length
      : tournaments.filter((tournament) => tournament.status === option).length
  }

  function handleCreated(tournament: TournamentRecord) {
    navigate(`/tournaments/${tournament.id}`)
  }

  return (
    <>
      <PageHeader
        kicker="Competition floor"
        title="Tournaments"
        description="Every draw, every event, and the official record of who won. A completed tournament match awards double ShuttlePower impact."
        stats={[
          { label: 'On record', value: String(tournaments.length) },
          { label: 'Live now', value: String(live) },
          { label: 'Open', value: String(published) },
          { label: 'Drafts', value: String(drafts) },
        ]}
        actions={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              Create tournament
            </Button>
          ) : null
        }
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not load tournaments"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((option) => {
          const active = status === option
          const count = countFor(option)

          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(option)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[11px] uppercase tracking-[0.06em] transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
                active
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              {option === 'all' ? 'All' : TOURNAMENT_STATUS_LABELS[option]}
              <span className="font-mono tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-3">
        {loading ? (
          <LoadingState label="Loading tournaments" rows={5} />
        ) : error ? null : tournaments.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tournaments yet"
            description={
              canManage
                ? 'Create a draft, add its events, then publish it for the club.'
                : 'Tournament staff have not published a tournament yet.'
            }
            action={
              canManage ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus aria-hidden="true" />
                  Create tournament
                </Button>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No tournaments match"
            description={`There are no ${TOURNAMENT_STATUS_LABELS[
              status as TournamentStatus
            ].toLowerCase()} tournaments.`}
            action={
              <Button variant="secondary" onClick={() => setStatus('all')}>
                Clear filter
              </Button>
            }
          />
        ) : (
          <>
            <SectionHeading
              index="01"
              title="Draw board"
              description={`${filtered.length} of ${tournaments.length} tournament${
                tournaments.length === 1 ? '' : 's'
              } shown.`}
            />

            <ul className="mt-1 divide-y divide-border">
              {filtered.map((tournament) => {
                const day = dateBlock(tournament.starts_on)
                const days = daysBetween(today, tournament.starts_on)
                const board = progress.get(tournament.id)
                const countdown =
                  tournament.status === 'in_progress'
                    ? 'Live now'
                    : tournament.status === 'completed' || tournament.status === 'archived'
                      ? null
                      : days === null
                        ? null
                        : days <= 0
                          ? 'Today'
                          : days === 1
                            ? 'Tomorrow'
                            : `In ${days} days`

                return (
                  <li key={tournament.id}>
                    <Link
                      to={`/tournaments/${tournament.id}`}
                      className="row-action group flex items-center gap-3 rounded-sm px-3 py-3 transition-colors duration-fast hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ring"
                    >
                      <span className="grid w-11 shrink-0 place-items-center rounded-sm border border-border bg-surface-2 py-1">
                        <span className="text-[9px] uppercase tracking-[0.1em] text-text-faint">
                          {day.month}
                        </span>
                        <span className="font-mono text-base font-semibold leading-none tabular-nums text-text">
                          {day.day}
                        </span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-text">
                            {tournament.name}
                          </span>
                          <StatusBadge status={tournament.status} />
                        </span>

                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" aria-hidden="true" />
                            {formatDateRange(tournament.starts_on, tournament.ends_on)}
                          </span>
                          {tournament.venue ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden="true" />
                              {tournament.venue}
                            </span>
                          ) : null}
                          <span>
                            {Number(tournament.entrance_fee) === 0
                              ? 'Free entry'
                              : `${formatMoney(tournament.entrance_fee)} entry`}
                          </span>
                        </span>

                        {board ? (
                          <span className="mt-1.5 flex flex-wrap items-center gap-2">
                            {board.events > 0 ? (
                              <ProgressTrack
                                value={
                                  board.matches > 0
                                    ? board.playedMatches / board.matches
                                    : board.drawnEvents / board.events
                                }
                                label={`Draw and result progress for ${tournament.name}`}
                                tone={
                                  board.matches > 0 && board.playedMatches === board.matches
                                    ? 'accent'
                                    : 'info'
                                }
                                edge={false}
                                className="w-20 shrink-0"
                              />
                            ) : null}
                            <span className="font-mono text-[10px] tabular-nums text-text-faint">
                              {progressText(board)}
                            </span>
                          </span>
                        ) : null}

                        {tournament.registration_deadline ? (
                          <span className="mt-0.5 block text-[11px] text-text-faint">
                            Registration closes {formatDateTime(tournament.registration_deadline)}
                          </span>
                        ) : null}
                      </span>

                      {countdown ? (
                        <Badge
                          tone={tournament.status === 'in_progress' ? 'accent' : 'info'}
                          className="shrink-0"
                        >
                          {countdown}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <p className="px-3 pt-2 text-[11px] leading-snug text-text-faint">
              Open a tournament for its poster, events, brackets, and results.
            </p>
          </>
        )}
      </div>

      <TournamentFormDialog
        key={formOpen ? 'create-tournament-open' : 'create-tournament-closed'}
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
