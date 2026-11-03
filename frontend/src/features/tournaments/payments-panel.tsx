import { Wallet } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/features/auth/api'
import type { PlayerRecord } from '@/features/players/types'
import { formatMoney } from '@/features/training/money'

import { setEntryPayment } from './api'
import { entryName, type EntryLookups } from './display'
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type PaymentRecord,
  type PaymentStatus,
  type TeamMemberRecord,
  type TournamentEntryRecord,
} from './types'

interface PaymentsPanelProps {
  entries: readonly TournamentEntryRecord[]
  teamMembers: readonly TeamMemberRecord[]
  players: readonly PlayerRecord[]
  payments: readonly PaymentRecord[]
  canManage: boolean
  onChanged: () => void
}

function paymentLabel(
  payment: PaymentRecord,
  playersById: ReadonlyMap<string, PlayerRecord>,
): string {
  if (payment.guest_name) return `${payment.guest_name} (guest)`

  if (payment.player_id) {
    return playersById.get(payment.player_id)?.full_name ?? 'Unknown player'
  }

  return 'Participant'
}

/**
 * Per-participant entrance-fee rows. Staff can confirm each row; players see
 * only their own rows (and their teammates') because RLS filters the read.
 */
export function PaymentsPanel({
  entries,
  teamMembers,
  players,
  payments,
  canManage,
  onChanged,
}: PaymentsPanelProps) {
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  const teamMembersByTeam = React.useMemo(() => {
    const grouped = new Map<string, TeamMemberRecord[]>()

    for (const member of teamMembers) {
      const list = grouped.get(member.team_id) ?? []
      list.push(member)
      grouped.set(member.team_id, list)
    }

    return grouped
  }, [teamMembers])

  const lookups: EntryLookups = React.useMemo(
    () => ({ playersById, teamMembersByTeam }),
    [playersById, teamMembersByTeam],
  )

  const paymentsByEntry = React.useMemo(() => {
    const grouped = new Map<string, PaymentRecord[]>()

    for (const payment of payments) {
      const list = grouped.get(payment.entry_id) ?? []
      list.push(payment)
      grouped.set(payment.entry_id, list)
    }

    return grouped
  }, [payments])

  const visibleEntries = entries.filter((entry) => (paymentsByEntry.get(entry.id)?.length ?? 0) > 0)

  async function handleStatus(payment: PaymentRecord, status: PaymentStatus) {
    if (payment.status === status) return

    setBusyId(payment.id)

    try {
      await setEntryPayment(payment.id, status)
      toast.success(
        status === 'paid'
          ? `${paymentLabel(payment, playersById)} marked paid.`
          : status === 'waived'
            ? `${paymentLabel(payment, playersById)} waived.`
            : `${paymentLabel(payment, playersById)} marked unpaid.`,
      )
      onChanged()
    } catch (paymentError) {
      toast.error(errorMessage(paymentError))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-accent" aria-hidden="true" />
          Entrance fees
        </CardTitle>
        <CardDescription>
          {canManage
            ? 'Confirm each participant. Only fully paid or waived entries enter the draw.'
            : 'Your payment status. Staff confirm payments before the draw.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visibleEntries.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No fee rows"
            description={
              canManage
                ? 'Fee rows appear when players are registered.'
                : 'No payment is visible for this event yet.'
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {visibleEntries.map((entry) => {
              const rows = paymentsByEntry.get(entry.id) ?? []

              return (
                <div key={entry.id} className="rounded-sm border border-border">
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-sm font-medium text-text">{entryName(entry, lookups)}</p>
                  </div>
                  <ul className="divide-y divide-border">
                    {rows.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text">
                            {paymentLabel(payment, playersById)}
                          </p>
                          <p className="text-xs text-text-faint">{formatMoney(payment.amount)}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={payment.status} />
                          {canManage ? (
                            <Select
                              value={payment.status}
                              onValueChange={(value) =>
                                void handleStatus(payment, value as PaymentStatus)
                              }
                              disabled={busyId === payment.id}
                            >
                              <SelectTrigger className="w-32" aria-label="Payment status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {PAYMENT_STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
