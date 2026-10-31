import { Plus, SearchX, Trophy } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
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
import { errorMessage } from '@/features/auth/api'
import { hasAnyRole } from '@/features/auth/types'
import { useSession } from '@/features/auth/session-context'
import { listTournaments } from '@/features/tournaments/api'
import { TournamentFormDialog } from '@/features/tournaments/tournament-form-dialog'
import {
  TOURNAMENT_STAFF_ROLES,
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_LABELS,
  type TournamentRecord,
  type TournamentStatus,
} from '@/features/tournaments/types'
import { formatDateRange } from '@/lib/format'

type StatusFilter = 'all' | TournamentStatus

const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...TOURNAMENT_STATUSES]

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

  const filtered = React.useMemo(
    () =>
      status === 'all'
        ? tournaments
        : tournaments.filter((tournament) => tournament.status === status),
    [tournaments, status],
  )

  function handleCreated(tournament: TournamentRecord) {
    navigate(`/tournaments/${tournament.id}`)
  }

  return (
    <>
      <PageHeader
        title="Tournaments"
        description="Create tournaments, generate draws, and keep the official record of every result."
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

      <div className="mt-5 flex items-center gap-2">
        <div>
          <label htmlFor="tournament-status-filter" className="sr-only">
            Filter by status
          </label>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger id="tournament-status-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === 'all' ? 'All statuses' : TOURNAMENT_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
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
            <p className="mb-2 text-xs text-text-muted" aria-live="polite">
              {filtered.length} of {tournaments.length} tournament
              {tournaments.length === 1 ? '' : 's'}
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Dates</TableHead>
                  <TableHead className="hidden md:table-cell">Venue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tournament) => (
                  <TableRow key={tournament.id}>
                    <TableCell className="max-w-64">
                      <Link
                        to={`/tournaments/${tournament.id}`}
                        className="inline-flex max-w-full rounded-sm font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                      >
                        <span className="truncate">{tournament.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tournament.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-text-muted sm:table-cell">
                      {formatDateRange(tournament.starts_on, tournament.ends_on)}
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate text-text-muted md:table-cell">
                      {tournament.venue ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
