import { RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PROVISIONAL_RULE_NOTICE } from '@/domain/sp'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { getPlayerByProfile } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import {
  getCurrentRuleVersion,
  listPlayerSpHistory,
  listSpLeaderboard,
  reconcileSpBalances,
} from '@/features/shuttlepower/api'
import { rankLeaderboard } from '@/features/shuttlepower/leaderboard'
import {
  SP_TRANSACTION_LABELS,
  type ReconciliationResult,
  type SpLeaderboardEntry,
  type SpRuleVersionRecord,
  type SpTransactionRecord,
} from '@/features/shuttlepower/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

function formatSp(value: number): string {
  return value.toLocaleString()
}

function signedSp(value: number): string {
  return value > 0 ? `+${formatSp(value)}` : formatSp(value)
}

export function ShuttlepowerPage() {
  const { user } = useSession()
  const isSuperAdmin = hasAnyRole(user?.roles ?? [], ['super_admin'])

  const [rule, setRule] = React.useState<SpRuleVersionRecord | null>(null)
  const [leaderboard, setLeaderboard] = React.useState<SpLeaderboardEntry[]>([])
  const [ownPlayer, setOwnPlayer] = React.useState<PlayerRecord | null>(null)
  const [history, setHistory] = React.useState<SpTransactionRecord[]>([])
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
        const rows = player ? await listPlayerSpHistory(player.id) : []

        if (!active) return

        setRule(nextRule)
        setLeaderboard(nextLeaderboard)
        setOwnPlayer(player)
        setHistory(rows)
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
  }, [user, reloadKey])

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
        <PageHeader title="ShuttlePower" />
        <LoadingState className="mt-6" label="Loading ShuttlePower" rows={5} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="ShuttlePower" />
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

  return (
    <>
      <PageHeader
        title="ShuttlePower"
        description="The club's competitive point rating. Official tournament matches carry twice the friendly impact."
      />

      <Card className="mt-5">
        <CardContent className="flex items-start gap-3 p-5">
          <Badge tone={ruleLive ? 'accent' : 'warning'}>
            {ruleLive ? 'Active' : 'Provisional'}
          </Badge>

          <div className="min-w-0">
            <p className="text-sm font-medium text-text">
              {ruleLive ? 'An approved rule version is live.' : PROVISIONAL_RULE_NOTICE}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {rule
                ? `Rule version ${rule.version} · ${rule.status}${rule.is_enabled ? ' · enabled' : ' · disabled'}. ${rule.notes ?? ''}`
                : 'No rule version is stored yet. No match can award SP without one.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Current SP leaderboard</CardTitle>
          <CardDescription>
            Cached balances, which reconciliation checks against the immutable ledger. Equal SP
            shares a position.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No SP accounts yet"
              description="A player receives 1,000 SP when their registration is approved."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pos</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">SP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((row) => (
                  <TableRow key={row.playerId}>
                    <TableCell className="tabular-nums text-text-muted">{row.position}</TableCell>
                    <TableCell className="max-w-64 truncate font-medium text-text">
                      {row.fullName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-text">
                      {formatSp(row.sp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Your SP history</CardTitle>
          <CardDescription>
            Every change to your own balance, newest first. Ledger rows are append-only and never
            rewritten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ownPlayer ? (
            <EmptyState
              icon={Zap}
              title="No player record linked"
              description="Your SP history appears once your approved account is linked to a player record."
            />
          ) : history.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No SP changes yet"
              description="Your starting award and any future match results will appear here."
            />
          ) : (
            <Table>
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
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Balance check</CardTitle>
            <CardDescription>
              Verifies that every cached balance equals its ledger sum. It reports mismatches and
              never writes a repair.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="secondary"
              className="self-start"
              loading={reconciling}
              onClick={() => void handleReconcile()}
            >
              <ShieldCheck aria-hidden="true" />
              Check balances
            </Button>

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
                    {reconciliation.mismatches.length === 1 ? '' : 's'} differ from the ledger:
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
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
