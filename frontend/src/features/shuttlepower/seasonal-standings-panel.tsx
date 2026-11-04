import { CalendarRange, Trophy, Zap } from 'lucide-react'
import * as React from 'react'

import { ArenaPanel } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { Badge } from '@/components/ui/badge'
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
import { listSeasonalStandings, listSeasons } from '@/features/shuttlepower/api'
import {
  SEASON_EXCLUSION_LABELS,
  type SeasonRecord,
  type SeasonalStandingRecord,
} from '@/features/shuttlepower/types'
import { cn } from '@/lib/cn'
import { formatDateRange } from '@/lib/format'

interface SeasonalStandingsPanelProps {
  /** The signed-in player, highlighted when they appear in the table. */
  highlightPlayerId?: string | null
  className?: string
}

function formatSp(value: number): string {
  return value.toLocaleString()
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function currentSeason(seasons: SeasonRecord[]): SeasonRecord | undefined {
  return seasons.find((season) => season.status === 'active') ?? seasons[0]
}

/**
 * S15 seasonal leaderboard.
 *
 * While a season is open the RPC returns the provisional live table; once it is
 * closed the same call reads the immutable S19 snapshot. The UI never computes a
 * position itself — ranking, tie-breaks, and exclusions all live in migration
 * 018 so the screen and the snapshot cannot disagree.
 */
export function SeasonalStandingsPanel({
  highlightPlayerId,
  className,
}: SeasonalStandingsPanelProps) {
  const [seasons, setSeasons] = React.useState<SeasonRecord[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = React.useState<string | null>(null)
  const [standings, setStandings] = React.useState<SeasonalStandingRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextSeasons, nextStandings] = await Promise.all([
          listSeasons(),
          listSeasonalStandings(selectedSeasonId),
        ])

        if (!active) return

        setSeasons(nextSeasons)
        setStandings(nextStandings)
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
  }, [selectedSeasonId, reloadKey])

  const season = selectedSeasonId
    ? (seasons.find((row) => row.id === selectedSeasonId) ?? currentSeason(seasons))
    : currentSeason(seasons)
  const provisional = standings[0]?.provisional ?? season?.status !== 'closed'
  const ranked = standings.filter((row) => row.position !== null)

  return (
    <ArenaPanel
      kicker="Seasonal race"
      title={season ? season.label : 'Seasonal leaderboard'}
      description={
        season
          ? `${formatDateRange(season.starts_on, season.ends_on)} · ${
              provisional ? 'provisional live table' : 'final snapshot'
            }`
          : 'Seasonal SP is earned only from results finalized inside the season.'
      }
      className={className}
      bodyClassName="p-0"
    >
      {loading ? (
        <LoadingState className="p-4" label="Loading seasonal standings" rows={4} />
      ) : error ? (
        <ErrorState
          className="m-4"
          title="Could not load seasonal standings"
          description={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : seasons.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={CalendarRange}
            title="No season yet"
            description="A Super Admin creates the calendar season from the seasonal recovery screen. Standings appear once the season is active."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Badge tone={provisional ? 'warning' : 'accent'}>
                {provisional ? 'Provisional' : 'Final'}
              </Badge>
              <span className="text-[11px] text-text-faint">
                {ranked.length} ranked · {standings.length} with an SP account
              </span>
            </div>

            <Select value={season?.id ?? ''} onValueChange={(value) => setSelectedSeasonId(value)}>
              <SelectTrigger className="h-8 w-52 text-xs" aria-label="Season">
                <SelectValue placeholder="Choose a season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                    {row.status === 'active' ? ' · active' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {standings.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Zap}
                title="No Seasonal SP yet"
                description="No player has an SP account in this season, or no result has been finalized inside it."
              />
            </div>
          ) : (
            <Table containerClassName="rounded-none border-0">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pos</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Seasonal SP</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Matches</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Wins</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Tourn.</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Game ±</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Point ±</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((row) => {
                  const own = row.player_id === highlightPlayerId
                  const reason = row.excluded_reason

                  return (
                    <TableRow key={row.player_id} className={own ? 'bg-accent-soft' : undefined}>
                      <TableCell className="tabular-nums text-text-muted">
                        {row.position ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-56 truncate font-medium text-text">
                        {row.full_name}
                        {row.position === 1 && reason === null ? (
                          <Trophy
                            className="ml-1.5 inline size-3 text-warning"
                            aria-label="Season leader"
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text">
                        {formatSp(row.seasonal_sp)}
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-muted sm:table-cell">
                        {row.matches_played}
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-muted sm:table-cell">
                        {row.wins}
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-muted md:table-cell">
                        {row.tournament_wins}/{row.tournament_matches}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'hidden text-right font-mono text-sm tabular-nums lg:table-cell',
                          row.game_difference > 0
                            ? 'text-accent'
                            : row.game_difference < 0
                              ? 'text-danger'
                              : 'text-text-muted',
                        )}
                      >
                        {signedNumber(row.game_difference)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'hidden text-right font-mono text-sm tabular-nums lg:table-cell',
                          row.point_difference > 0
                            ? 'text-accent'
                            : row.point_difference < 0
                              ? 'text-danger'
                              : 'text-text-muted',
                        )}
                      >
                        {signedNumber(row.point_difference)}
                      </TableCell>
                      <TableCell>
                        {reason ? (
                          <Badge tone="warning">{SEASON_EXCLUSION_LABELS[reason]}</Badge>
                        ) : row.position === null ? (
                          <Badge tone="neutral">Unranked</Badge>
                        ) : (
                          <Badge tone="accent">Ranked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          <p className="border-t border-border px-4 py-2 text-[10px] leading-snug text-text-faint">
            Seasonal SP comes from results finalized inside the season. A result finalized after the
            cutoff counts nowhere. Tournament wins break a Seasonal SP tie, then head-to-head, game
            difference, and point difference. A player with no eligible match keeps the last earned
            position; a negative balance is excluded but still deducted at that previous tier.
          </p>
        </>
      )}
    </ArenaPanel>
  )
}
