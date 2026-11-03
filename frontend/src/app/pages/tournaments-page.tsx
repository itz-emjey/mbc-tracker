import { CalendarDays, MapPin, Plus, SearchX, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ArenaPanel, ArenaStatStrip } from '@/components/arena/arena-ui'
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
import { listTournaments } from '@/features/tournaments/api'
import { TournamentFormDialog } from '@/features/tournaments/tournament-form-dialog'
import {
  TOURNAMENT_STAFF_ROLES,
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_LABELS,
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

    void listTournaments()
      .then((nextTournaments) => {
        if (active) setTournaments(nextTournaments)
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

      <ArenaStatStrip
        className="mt-5"
        stats={[
          {
            label: 'Tournaments',
            value: String(tournaments.length),
            detail: 'On the club record',
          },
          { label: 'In play', value: String(live), detail: 'Draws running right now' },
          { label: 'Published', value: String(published), detail: 'Open for registration' },
          { label: 'Drafts', value: String(drafts), detail: 'Not visible to members yet' },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
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
          <ArenaPanel
            kicker="Draw board"
            title={`${filtered.length} of ${tournaments.length} tournament${
              tournaments.length === 1 ? '' : 's'
            }`}
          >
            <ul className="divide-y divide-border">
              {filtered.map((tournament) => {
                const day = dateBlock(tournament.starts_on)
                const days = daysBetween(today, tournament.starts_on)
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
                      className="group flex items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ring"
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

            <p className="border-t border-border px-4 py-2 text-[10px] leading-snug text-text-faint">
              Open a tournament for its poster, events, brackets, and results.
            </p>
          </ArenaPanel>
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
