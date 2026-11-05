import { ChevronRight, Search, SearchX, UserPlus, Users } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { ArenaAvatar, SectionHeading } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { listPlayers } from '@/features/players/api'
import { visiblePlayers, type PlayerSort, type PlayerStatusFilter } from '@/features/players/filter'
import { PlayerFormDialog } from '@/features/players/player-form-dialog'
import {
  PLAYER_STAFF_ROLES,
  PLAYER_STATUSES,
  PLAYER_STATUS_LABELS,
  type PlayerRecord,
} from '@/features/players/types'
import { formatDate } from '@/lib/format'

const STATUS_FILTERS: readonly PlayerStatusFilter[] = ['all', ...PLAYER_STATUSES]

const SORT_LABELS: Record<PlayerSort, string> = {
  name: 'Name (A–Z)',
  joined: 'Newest joined',
  status: 'Status',
}

export function PlayersPage() {
  const { user } = useSession()
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [query, setQuery] = React.useState('')
  const [status, setStatus] = React.useState<PlayerStatusFilter>('all')
  const [sort, setSort] = React.useState<PlayerSort>('name')
  const [formOpen, setFormOpen] = React.useState(false)

  const canManage = hasAnyRole(user?.roles ?? [], PLAYER_STAFF_ROLES)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    void listPlayers()
      .then((nextPlayers) => {
        if (active) setPlayers(nextPlayers)
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
    () => visiblePlayers(players, { query, status, sort }),
    [players, query, status, sort],
  )

  const hasFilters = query.trim() !== '' || status !== 'all'
  const active = players.filter((player) => player.status === 'active').length
  const linked = players.filter((player) => player.profile_id !== null).length

  function clearFilters() {
    setQuery('')
    setStatus('all')
  }

  return (
    <>
      <PageHeader
        kicker="Club roster"
        title="Players"
        description="Every fighter on the club record. Approved members can browse it; staff maintain the records and link accounts."
        stats={[
          { label: 'On the roster', value: String(players.length) },
          { label: 'Active', value: String(active) },
          { label: 'Linked', value: String(linked) },
          { label: 'No account', value: String(Math.max(0, players.length - linked)) },
        ]}
        actions={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus aria-hidden="true" />
              Add player
            </Button>
          ) : null
        }
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not load players"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
            aria-hidden="true"
          />
          <label htmlFor="player-search" className="sr-only">
            Search players by name
          </label>
          <Input
            id="player-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the roster by name"
            className="pl-9"
            autoComplete="off"
          />
        </div>

        <div className="flex items-center gap-2">
          <div>
            <label htmlFor="player-status-filter" className="sr-only">
              Filter by status
            </label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as PlayerStatusFilter)}
            >
              <SelectTrigger id="player-status-filter" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'all' ? 'All statuses' : PLAYER_STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="player-sort" className="sr-only">
              Sort players
            </label>
            <Select value={sort} onValueChange={(value) => setSort(value as PlayerSort)}>
              <SelectTrigger id="player-sort" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as PlayerSort[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {SORT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <LoadingState label="Loading players" rows={5} />
        ) : error ? null : players.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No players yet"
            description={
              canManage
                ? 'Add the first directory record. Approved accounts can be linked to it later.'
                : 'The club directory is empty. Staff can add player records.'
            }
            action={
              canManage ? (
                <Button onClick={() => setFormOpen(true)}>
                  <UserPlus aria-hidden="true" />
                  Add player
                </Button>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No players match"
            description="Try a different name or status filter."
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <SectionHeading
              index="01"
              title="Roster"
              description={`Showing ${filtered.length} of ${players.length} player${
                players.length === 1 ? '' : 's'
              }.`}
            />

            <ul className="mt-1 divide-y divide-border" aria-live="polite">
              {filtered.map((player) => {
                const isActive = player.status === 'active'

                return (
                  <li key={player.id}>
                    <Link
                      to={`/players/${player.id}`}
                      className="row-action group flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors duration-fast hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ring"
                    >
                      <ArenaAvatar
                        name={player.full_name}
                        size="md"
                        tone={isActive ? 'accent' : 'neutral'}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {player.full_name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-text-faint">
                          {player.player_code} · joined {formatDate(player.joined_on)}
                        </span>
                      </span>

                      <span className="hidden shrink-0 sm:block">
                        <StatusBadge status={player.status} />
                      </span>
                      {player.profile_id ? (
                        <Badge tone="accent" className="hidden shrink-0 md:inline-flex">
                          Linked
                        </Badge>
                      ) : (
                        <span className="hidden shrink-0 text-[10px] text-text-faint md:inline">
                          No account
                        </span>
                      )}
                      <ChevronRight
                        className="size-4 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <PlayerFormDialog
        key={formOpen ? 'add-player-open' : 'add-player-closed'}
        open={formOpen}
        player={null}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />
    </>
  )
}
