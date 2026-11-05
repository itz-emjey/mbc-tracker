import { CalendarRange, Crown, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ArenaAvatar, ProgressTrack, RankBadge, SectionHeading } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { tierFor } from '@/domain/arena'
import { PROVISIONAL_RULE_NOTICE } from '@/domain/sp'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { getPlayerByProfile } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import {
  getCurrentRuleVersion,
  getPlacementProgress,
  listPlacementAudit,
  listPlayerSpHistory,
  listSpLeaderboard,
  reconcileSpBalances,
} from '@/features/shuttlepower/api'
import { rankLeaderboard } from '@/features/shuttlepower/leaderboard'
import { SeasonalStandingsPanel } from '@/features/shuttlepower/seasonal-standings-panel'
import {
  SP_TRANSACTION_LABELS,
  type PlacementAuditRecord,
  type PlacementProgressRecord,
  type ReconciliationResult,
  type SpLeaderboardEntry,
  type SpRuleVersionRecord,
  type SpTransactionRecord,
} from '@/features/shuttlepower/types'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

function formatSp(value: number): string {
  return value.toLocaleString()
}

function signedSp(value: number): string {
  return value > 0 ? `+${formatSp(value)}` : formatSp(value)
}

/** A quiet third-level label, used for the blocks inside a section. */
function BlockHeading({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {children}
      </h3>
      {action ? (
        <span className="font-mono text-[10px] tabular-nums text-text-faint">{action}</span>
      ) : null}
    </div>
  )
}

export function ShuttlepowerPage() {
  const { user } = useSession()
  const isSuperAdmin = hasAnyRole(user?.roles ?? [], ['super_admin'])

  const [rule, setRule] = React.useState<SpRuleVersionRecord | null>(null)
  const [leaderboard, setLeaderboard] = React.useState<SpLeaderboardEntry[]>([])
  const [ownPlayer, setOwnPlayer] = React.useState<PlayerRecord | null>(null)
  const [history, setHistory] = React.useState<SpTransactionRecord[]>([])
  const [placement, setPlacement] = React.useState<PlacementProgressRecord | null>(null)
  const [placementAudit, setPlacementAudit] = React.useState<PlacementAuditRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [reconciling, setReconciling] = React.useState(false)
  const [reconciliation, setReconciliation] = React.useState<ReconciliationResult | null>(null)

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextRule, nextLeaderboard] = await Promise.all([
          getCurrentRuleVersion(),
          listSpLeaderboard(),
        ])
        const player = user ? await getPlayerByProfile(user.id) : null
        const [rows, progress, audit] = await Promise.all([
          player ? listPlayerSpHistory(player.id) : Promise.resolve([]),
          player ? getPlacementProgress(player.id) : Promise.resolve(null),
          isSuperAdmin ? listPlacementAudit() : Promise.resolve([]),
        ])

        if (!active) return

        setRule(nextRule)
        setLeaderboard(nextLeaderboard)
        setOwnPlayer(player)
        setHistory(rows)
        setPlacement(progress)
        setPlacementAudit(audit)
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
  }, [user, isSuperAdmin, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  const ranked = React.useMemo(() => rankLeaderboard(leaderboard), [leaderboard])

  async function handleReconcile() {
    setReconciling(true)

    try {
      const result = await reconcileSpBalances()
      setReconciliation(result)

      if (result.consistent) {
        toast.success(
          `Balances match the ledger for ${result.checked} account${result.checked === 1 ? '' : 's'}.`,
        )
      } else {
        toast.error(
          `${result.mismatches.length} cached balance${result.mismatches.length === 1 ? '' : 's'} differ from the ledger.`,
        )
      }
    } catch (reconcileError) {
      toast.error(errorMessage(reconcileError))
    } finally {
      setReconciling(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader kicker="Competitive rating" title="ShuttlePower" />
        <LoadingState className="mt-6" label="Loading ShuttlePower" rows={5} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader kicker="Competitive rating" title="ShuttlePower" />
        <ErrorState
          className="mt-6"
          title="Could not load ShuttlePower"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  const ruleLive = rule !== null && rule.status === 'approved' && rule.is_enabled
  const ownRow = ownPlayer ? ranked.find((row) => row.playerId === ownPlayer.id) : undefined
  const ownTier = ownRow ? tierFor(ownRow.sp).tier : null
  const podium = ranked.slice(0, 3)
  const unrated = ownPlayer?.rating_status === 'unrated'
  const placementCredits = placement?.credits ?? 0
  const placementRequired = placement?.required ?? 10
  const placementRatio =
    placementRequired > 0 ? Math.min(1, placementCredits / placementRequired) : 0

  return (
    <>
      <PageHeader
        kicker="Competitive rating"
        title="ShuttlePower"
        description="The club's strength-based rating. Official tournament matches carry twice the friendly impact."
        stats={[
          { label: 'Your SP', value: unrated ? 'Hidden' : ownRow ? formatSp(ownRow.sp) : '—' },
          { label: 'Rank', value: unrated ? 'Unrated' : (ownTier?.rankTitle ?? '—') },
          { label: 'Position', value: unrated ? '—' : ownRow ? `#${ownRow.position}` : '—' },
          { label: 'Ledger', value: unrated ? 'Hidden' : String(history.length) },
        ]}
      >
        {unrated ? (
          <div className="rounded-md border border-border bg-surface-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-text">
                Placement · {placementCredits}/{placementRequired} matches
              </p>
              <Badge tone="warning">Provisional value hidden</Badge>
            </div>

            <ProgressTrack
              className="mt-2"
              value={placementRatio}
              tone="warning"
              label={`${placementCredits} of ${placementRequired} placement matches`}
            />

            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              {Math.max(0, placementRequired - placementCredits)} match
              {placementRequired - placementCredits === 1 ? '' : 'es'} to go. It is published
              unchanged at qualification. Walkovers, no-shows, forfeits, withdrawals, and
              disqualifications do not count.
            </p>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            <Badge tone={ruleLive ? 'accent' : 'warning'}>
              {ruleLive ? 'Rule live' : 'Rule inactive'}
            </Badge>
            {ruleLive
              ? `Approved ${rule?.version ?? 'rule version'} · confirmed friendlies and completed tournament matches award SP.`
              : PROVISIONAL_RULE_NOTICE}
          </p>
        )}
      </PageHeader>

      <section className="mt-8" aria-label="Standing">
        <SectionHeading
          index="01"
          title="Standing"
          description="The podium, the club ladder, and the season race — all read from the same balances."
        />

        {podium.length > 0 ? (
          <div className="mt-5">
            <BlockHeading action={`${ranked.length} ranked`}>Top three</BlockHeading>

            <div className="mt-3 grid grid-cols-3 items-end gap-2 sm:gap-3">
              {[2, 1, 3].map((place) => {
                const row = podium.find((entry) => entry.position === place)
                const tier = row ? tierFor(row.sp).tier : null
                const tower = place === 1 ? 'h-24' : place === 2 ? 'h-16' : 'h-12'
                const tone =
                  place === 1
                    ? 'border-gold-soft bg-gold-soft'
                    : place === 2
                      ? 'border-silver-soft bg-silver-soft'
                      : 'border-bronze-soft bg-bronze-soft'

                return (
                  <div key={place} className="flex min-w-0 flex-col">
                    {row && tier ? (
                      <div className="flex flex-col items-center gap-1.5 pb-3 text-center">
                        {place === 1 ? (
                          <Crown className="size-4 text-gold" aria-hidden="true" />
                        ) : null}
                        <ArenaAvatar
                          name={row.fullName}
                          size="md"
                          tone={tier.tone}
                          ring={place === 1}
                        />
                        <p className="w-full truncate text-xs font-medium text-text">
                          {row.fullName}
                        </p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-text">
                          {formatSp(row.sp)}
                        </p>
                      </div>
                    ) : (
                      <div className="pb-3 text-center text-[11px] text-text-faint">Open</div>
                    )}

                    <div
                      className={cn(
                        'grid place-items-center rounded-t-md border border-b-0',
                        tower,
                        tone,
                      )}
                    >
                      <span className="font-mono text-xl font-semibold tabular-nums text-text">
                        {place}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <BlockHeading action={`${ranked.length} on the ladder`}>Club ladder</BlockHeading>

          {ranked.length === 0 ? (
            <EmptyState
              className="mt-3"
              icon={Zap}
              title="No SP accounts yet"
              description="A player receives 1,000 SP when their registration is approved."
            />
          ) : (
            <>
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Pos</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead className="text-right">Rank pos</TableHead>
                    <TableHead className="text-right">SP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((row) => {
                    const own = row.playerId === ownPlayer?.id

                    return (
                      <TableRow key={row.playerId} className={own ? 'bg-accent-soft' : undefined}>
                        <TableCell className="tabular-nums text-text-muted">
                          {row.position}
                        </TableCell>
                        <TableCell className="max-w-64 truncate font-medium text-text">
                          {row.fullName}
                        </TableCell>
                        <TableCell>
                          <RankBadge tier={tierFor(row.sp).tier} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                          #{row.divisionPosition}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums text-text">
                          {formatSp(row.sp)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <p className="mt-2.5 max-w-3xl text-[10px] leading-relaxed text-text-faint">
                Unrated players are excluded until they finish placement. Balanced cached balances
                are what reconciliation checks against the immutable ledger. Equal SP shares a
                position, including inside a rank. Rank titles map to divisions: Rookie (Feather),
                Challenger (Rally), Striker (Smash), Elite (Apex), Champion (Legend). Divisions and
                titles are display labels and do not change the formula.
              </p>
            </>
          )}
        </div>

        <SeasonalStandingsPanel className="mt-6" highlightPlayerId={ownPlayer?.id ?? null} />
      </section>

      <section className="mt-8" aria-label="Ledger">
        <SectionHeading
          index="02"
          title="Ledger"
          description="Where your balance came from. Every change is a ledger row; the cached balance is only a sum of them."
        />

        <div className="mt-5">
          <BlockHeading action={`${history.length} entries`}>Your SP history</BlockHeading>

          {!ownPlayer ? (
            <EmptyState
              className="mt-3"
              icon={Zap}
              title="No player record linked"
              description="Your SP history appears once your approved account is linked to a player record."
            />
          ) : unrated ? (
            <EmptyState
              className="mt-3"
              icon={Zap}
              title="SP history is hidden during placement"
              description={`Your ledger becomes visible after ${placementRequired} eligible matches, when your provisional balance is published unchanged.`}
            />
          ) : history.length === 0 ? (
            <EmptyState
              className="mt-3"
              icon={Zap}
              title="No SP changes yet"
              description="Your starting award and any future match results will appear here."
            />
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
                  <TableHead className="hidden md:table-cell">Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-text-muted">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell className="text-text">
                      {SP_TRANSACTION_LABELS[entry.transaction_type] ?? entry.transaction_type}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-sm tabular-nums',
                        entry.sp_delta > 0 ? 'text-accent' : 'text-danger',
                      )}
                    >
                      {signedSp(entry.sp_delta)}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-muted sm:table-cell">
                      {formatSp(entry.sp_after)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-text-faint md:table-cell">
                      {entry.rule_version ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {isSuperAdmin ? (
          <details className="mt-6 overflow-hidden rounded-md border border-border bg-surface-1">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors duration-fast hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Audit and integrity
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                Super Admin
              </span>
            </summary>

            <div className="flex flex-col gap-6 border-t border-border p-4">
              <div>
                <BlockHeading action={`${placementAudit.length} records`}>
                  Provisional balances
                </BlockHeading>
                <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                  Players see placement progress, never the provisional value.
                </p>

                {placementAudit.length === 0 ? (
                  <EmptyState
                    className="mt-3"
                    icon={ShieldCheck}
                    title="No player records yet"
                    description="Placement progress appears once a player record exists."
                  />
                ) : (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="text-right">Placement</TableHead>
                        <TableHead className="text-right">Current SP</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">
                          Qualified SP
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {placementAudit.map((row) => (
                        <TableRow key={row.player_id}>
                          <TableCell className="max-w-56 truncate font-medium text-text">
                            {row.full_name}
                          </TableCell>
                          <TableCell>
                            <Badge tone={row.rating_status === 'unrated' ? 'warning' : 'neutral'}>
                              {row.rating_status === 'unrated' ? 'Unrated' : 'Rated'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                            {row.rating_status === 'unrated'
                              ? `${row.credits}/${row.required}`
                              : 'Qualified'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text">
                            {formatSp(row.current_sp)}
                          </TableCell>
                          <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-muted sm:table-cell">
                            {row.published_sp === null ? '—' : formatSp(row.published_sp)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="border-t border-border pt-5">
                <BlockHeading>Balance check</BlockHeading>
                <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                  Verifies that every cached balance equals its ledger sum. It reports mismatches
                  and never writes a repair.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/admin/seasons">
                      <CalendarRange aria-hidden="true" />
                      Seasons and deductions
                    </Link>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    loading={reconciling}
                    onClick={() => void handleReconcile()}
                  >
                    <ShieldCheck aria-hidden="true" />
                    Check balances
                  </Button>
                </div>

                <div className="mt-3">
                  {reconciliation ? (
                    reconciliation.consistent ? (
                      <p className="text-sm text-text-muted">
                        All {reconciliation.checked} cached balance
                        {reconciliation.checked === 1 ? '' : 's'} match the ledger.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p role="alert" className="text-sm font-medium text-danger">
                          {reconciliation.mismatches.length} balance
                          {reconciliation.mismatches.length === 1 ? '' : 's'} differ from the
                          ledger:
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead className="text-right">Cached</TableHead>
                              <TableHead className="text-right">Ledger</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reconciliation.mismatches.map((mismatch) => (
                              <TableRow key={mismatch.player_id}>
                                <TableCell className="font-mono text-xs text-text-muted">
                                  {mismatch.player_id}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm tabular-nums">
                                  {formatSp(mismatch.cached_sp)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm tabular-nums">
                                  {formatSp(Number(mismatch.ledger_sp))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-text-muted">
                      <RefreshCw className="mr-1 inline size-3" aria-hidden="true" />
                      Run the check after any manual data change.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </details>
        ) : null}
      </section>
    </>
  )
}
