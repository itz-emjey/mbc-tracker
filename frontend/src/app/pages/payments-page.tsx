import { Plus, Receipt, Wallet } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { SectionHeading } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { getPlayerByProfile, listPlayers } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import {
  createFeePeriod,
  listFeePeriods,
  listTrainingPayments,
  recordTrainingPayment,
  voidTrainingPayment,
} from '@/features/training/api'
import {
  formatMoney,
  paymentState,
  remainingAmount,
  sumRecorded,
  type PaymentState,
} from '@/features/training/money'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  TRAINING_STAFF_ROLES,
  type PaymentMethod,
  type TrainingFeePeriodRecord,
  type TrainingPaymentRecord,
} from '@/features/training/types'
import { feePeriodFormSchema, paymentFormSchema } from '@/features/training/validation'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

const STATE_TONES: Record<PaymentState, 'accent' | 'warning' | 'danger'> = {
  paid: 'accent',
  partial: 'warning',
  unpaid: 'danger',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function MoneyField({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 font-mono text-sm tabular-nums',
          muted ? 'text-text-muted' : 'text-text',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function PaymentsPage() {
  const { user } = useSession()
  const isStaff = hasAnyRole(user?.roles ?? [], TRAINING_STAFF_ROLES)

  const [periods, setPeriods] = React.useState<TrainingFeePeriodRecord[]>([])
  const [payments, setPayments] = React.useState<TrainingPaymentRecord[]>([])
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [ownPlayer, setOwnPlayer] = React.useState<PlayerRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [periodOpen, setPeriodOpen] = React.useState(false)
  const [payTarget, setPayTarget] = React.useState<TrainingFeePeriodRecord | null>(null)
  const [voidTarget, setVoidTarget] = React.useState<TrainingPaymentRecord | null>(null)

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextPeriods, nextPayments, nextPlayers] = await Promise.all([
          listFeePeriods(),
          listTrainingPayments(),
          listPlayers(),
        ])
        const player = user ? await getPlayerByProfile(user.id) : null

        if (!active) return

        setPeriods(nextPeriods)
        setPayments(nextPayments)
        setPlayers(nextPlayers)
        setOwnPlayer(player)
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

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  const activePlayers = React.useMemo(
    () =>
      players
        .filter((player) => player.status === 'active')
        .sort((left, right) => left.full_name.localeCompare(right.full_name)),
    [players],
  )

  const visiblePayments = isStaff
    ? payments
    : payments.filter((payment) => payment.player_id === ownPlayer?.id)

  const paymentsByPeriod = React.useMemo(() => {
    const grouped = new Map<string, TrainingPaymentRecord[]>()

    for (const payment of visiblePayments) {
      const list = grouped.get(payment.fee_period_id) ?? []
      list.push(payment)
      grouped.set(payment.fee_period_id, list)
    }

    return grouped
  }, [visiblePayments])

  const periodRows = React.useMemo(
    () =>
      periods.map((period) => {
        const paid = sumRecorded(paymentsByPeriod.get(period.id) ?? [])
        return { period, paid, state: paymentState(period.amount, paid) }
      }),
    [periods, paymentsByPeriod],
  )

  const periodsById = React.useMemo(
    () => new Map(periods.map((period) => [period.id, period])),
    [periods],
  )

  const paymentRows = React.useMemo(
    () =>
      visiblePayments.map((payment) => ({
        payment,
        periodLabel: periodsById.get(payment.fee_period_id)?.label ?? null,
      })),
    [visiblePayments, periodsById],
  )

  const collectedTotal = sumRecorded(visiblePayments)
  const latestPeriod = periods[0]
  const ownPaidLatest =
    ownPlayer && latestPeriod
      ? sumRecorded(
          visiblePayments.filter(
            (payment) =>
              payment.player_id === ownPlayer.id && payment.fee_period_id === latestPeriod.id,
          ),
        )
      : 0
  const ownDue = latestPeriod ? remainingAmount(latestPeriod.amount, ownPaidLatest) : null
  const voidedCount = visiblePayments.filter((payment) => payment.status === 'voided').length

  function playerName(playerId: string): string {
    return playersById.get(playerId)?.full_name ?? 'Unknown player'
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Payments" />
        <LoadingState className="mt-6" label="Loading payments" rows={5} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Payments" />
        <ErrorState
          className="mt-6"
          title="Could not load payments"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        kicker="Club ledger"
        title="Payments"
        description="Manual training fee records. Payments are never edited: a mistake is voided and recorded again."
        stats={[
          { label: 'Fee periods', value: String(periods.length) },
          { label: 'Payments', value: String(visiblePayments.length) },
          { label: 'Collected', value: formatMoney(collectedTotal) },
          {
            label: isStaff ? 'Voided' : 'Still due',
            value: isStaff ? String(voidedCount) : ownDue === null ? '—' : formatMoney(ownDue),
          },
        ]}
        actions={
          isStaff ? (
            <Button onClick={() => setPeriodOpen(true)}>
              <Plus aria-hidden="true" />
              New fee period
            </Button>
          ) : null
        }
      />

      <div className="mt-6">
        <SectionHeading
          index="01"
          title="Fee periods"
          description={
            isStaff
              ? 'Collected totals count recorded payments only. Voided rows stay in history.'
              : 'What each period costs, what you have paid, and what is still due.'
          }
        />
      </div>

      <div className="mt-4">
        {periods.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No fee periods yet"
            description={
              isStaff
                ? 'Create a period (for example 2026-11), then record payments against it.'
                : 'Training staff have not published a fee period yet.'
            }
            action={
              isStaff ? (
                <Button onClick={() => setPeriodOpen(true)}>
                  <Plus aria-hidden="true" />
                  New fee period
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border md:hidden">
              {periodRows.map(({ period, paid, state }) => (
                <li key={period.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{period.label}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-faint">
                        {formatDate(period.starts_on)} – {formatDate(period.ends_on)}
                      </p>
                    </div>
                    {isStaff ? null : <Badge tone={STATE_TONES[state]}>{state}</Badge>}
                  </div>

                  <dl className="mt-2.5 grid grid-cols-3 gap-2">
                    <MoneyField label="Fee" value={formatMoney(period.amount)} />
                    <MoneyField
                      label={isStaff ? 'Collected' : 'Paid'}
                      value={formatMoney(paid)}
                      muted
                    />
                    <MoneyField
                      label="Left"
                      value={formatMoney(remainingAmount(period.amount, paid))}
                      muted
                    />
                  </dl>

                  {isStaff ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => setPayTarget(period)}
                    >
                      <Receipt aria-hidden="true" />
                      Record payment
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    {isStaff ? <TableHead className="text-right">Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodRows.map(({ period, paid, state }) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium text-text">{period.label}</TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {formatDate(period.starts_on)} – {formatDate(period.ends_on)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatMoney(period.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                        {formatMoney(paid)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isStaff ? (
                          <span className="font-mono text-xs tabular-nums text-text-muted">
                            {formatMoney(remainingAmount(period.amount, paid))} left
                          </span>
                        ) : (
                          <Badge tone={STATE_TONES[state]}>{state}</Badge>
                        )}
                      </TableCell>
                      {isStaff ? (
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPayTarget(period)}
                          >
                            <Receipt aria-hidden="true" />
                            Record payment
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!isStaff && ownPlayer === null ? (
          <p className="mt-3 text-xs text-text-muted">
            Your payments appear once your account is linked to a player record.
          </p>
        ) : null}
      </div>

      <div className="mt-8">
        <SectionHeading
          index="02"
          title={isStaff ? 'Recorded payments' : 'Your payments'}
          description="Newest first. A voided row stays visible with its reason."
        />
      </div>

      <div className="mt-4">
        {visiblePayments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={isStaff ? 'No payments recorded' : 'No payments recorded yet'}
            description={
              isStaff
                ? 'Record a payment from a fee period above.'
                : 'Payments recorded by training staff will appear here.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border md:hidden">
              {paymentRows.map(({ payment, periodLabel }) => (
                <li key={payment.id} className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm text-text">
                      {isStaff ? playerName(payment.player_id) : (periodLabel ?? 'Training fee')}
                    </p>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-text">
                      {formatMoney(payment.amount)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone={payment.status === 'recorded' ? 'accent' : 'neutral'}>
                        {payment.status}
                      </Badge>
                      <span className="min-w-0 truncate font-mono text-[11px] text-text-faint">
                        {[
                          formatDate(payment.paid_on),
                          isStaff ? (periodLabel ?? '—') : null,
                          PAYMENT_METHOD_LABELS[payment.method],
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {isStaff && payment.status === 'recorded' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setVoidTarget(payment)}
                      >
                        Void
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {isStaff ? <TableHead>Player</TableHead> : null}
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    {isStaff ? <TableHead className="text-right">Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.map(({ payment, periodLabel }) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {formatDate(payment.paid_on)}
                      </TableCell>
                      {isStaff ? (
                        <TableCell className="max-w-48 truncate text-text">
                          {playerName(payment.player_id)}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-text-muted">{periodLabel ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text">
                        {formatMoney(payment.amount)}
                      </TableCell>
                      <TableCell className="text-text-muted">
                        {PAYMENT_METHOD_LABELS[payment.method]}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge tone={payment.status === 'recorded' ? 'accent' : 'neutral'}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      {isStaff ? (
                        <TableCell className="text-right">
                          {payment.status === 'recorded' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setVoidTarget(payment)}
                            >
                              Void
                            </Button>
                          ) : (
                            <span className="text-xs text-text-faint">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {periodOpen ? (
        <FeePeriodDialog
          open
          onOpenChange={setPeriodOpen}
          onCreated={() => {
            setPeriodOpen(false)
            reload()
          }}
        />
      ) : null}

      {payTarget ? (
        <RecordPaymentDialog
          period={payTarget}
          players={activePlayers}
          payments={payments.filter((payment) => payment.fee_period_id === payTarget.id)}
          onOpenChange={() => setPayTarget(null)}
          onSaved={() => {
            setPayTarget(null)
            reload()
          }}
        />
      ) : null}

      {voidTarget ? (
        <VoidPaymentDialog
          payment={voidTarget}
          playerName={playerName(voidTarget.player_id)}
          onOpenChange={() => setVoidTarget(null)}
          onVoided={() => {
            setVoidTarget(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

function FeePeriodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [values, setValues] = React.useState({
    label: new Date().toISOString().slice(0, 7),
    starts_on: `${today().slice(0, 7)}-01`,
    ends_on: today(),
    amount: '',
    due_on: '',
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    const parsed = feePeriodFormSchema.safeParse({
      label: values.label,
      starts_on: values.starts_on,
      ends_on: values.ends_on,
      amount: values.amount,
      due_on: values.due_on.trim() === '' ? null : values.due_on,
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}

      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'form')
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      }

      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)

    try {
      await createFeePeriod({
        label: parsed.data.label,
        starts_on: parsed.data.starts_on,
        ends_on: parsed.data.ends_on,
        amount: parsed.data.amount,
        due_on: parsed.data.due_on,
      })
      toast.success('Fee period created.')
      onCreated()
    } catch (submitError) {
      setFormError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New fee period</DialogTitle>
          <DialogDescription>
            One club-wide fee. Labels are unique, so a period cannot be created twice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-4">
            {formError ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="period-label">Label</Label>
              <Input
                id="period-label"
                placeholder="2026-11"
                value={values.label}
                onChange={(event) => update('label', event.target.value)}
              />
              {errors.label ? <p className="text-xs text-danger">{errors.label}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="period-starts">Starts</Label>
                <Input
                  id="period-starts"
                  type="date"
                  value={values.starts_on}
                  onChange={(event) => update('starts_on', event.target.value)}
                />
                {errors.starts_on ? (
                  <p className="text-xs text-danger">{errors.starts_on}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="period-ends">Ends</Label>
                <Input
                  id="period-ends"
                  type="date"
                  value={values.ends_on}
                  onChange={(event) => update('ends_on', event.target.value)}
                />
                {errors.ends_on ? <p className="text-xs text-danger">{errors.ends_on}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="period-amount">Amount (PHP)</Label>
                <Input
                  id="period-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={values.amount}
                  onChange={(event) => update('amount', event.target.value)}
                />
                {errors.amount ? <p className="text-xs text-danger">{errors.amount}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="period-due">Due date</Label>
                <Input
                  id="period-due"
                  type="date"
                  value={values.due_on}
                  onChange={(event) => update('due_on', event.target.value)}
                />
                {errors.due_on ? <p className="text-xs text-danger">{errors.due_on}</p> : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create period
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentDialog({
  period,
  players,
  payments,
  onOpenChange,
  onSaved,
}: {
  period: TrainingFeePeriodRecord
  players: readonly PlayerRecord[]
  payments: readonly TrainingPaymentRecord[]
  onOpenChange: () => void
  onSaved: () => void
}) {
  const [playerId, setPlayerId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [paidOn, setPaidOn] = React.useState(today())
  const [method, setMethod] = React.useState<PaymentMethod>('cash')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const paid = React.useMemo(
    () => sumRecorded(payments.filter((payment) => payment.player_id === playerId)),
    [payments, playerId],
  )
  const remaining = remainingAmount(period.amount, paid)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed = paymentFormSchema.safeParse({
      player_id: playerId,
      amount,
      paid_on: paidOn,
      method,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the payment fields.')
      return
    }

    if (parsed.data.amount > remaining) {
      setError(`That is more than the remaining balance of ${formatMoney(remaining)}.`)
      return
    }

    setSubmitting(true)

    try {
      const outcome = await recordTrainingPayment({
        fee_period_id: period.id,
        player_id: parsed.data.player_id,
        amount: parsed.data.amount,
        paid_on: parsed.data.paid_on,
        method: parsed.data.method as PaymentMethod,
      })

      toast.success(
        outcome.remaining > 0
          ? `Payment recorded. ${formatMoney(outcome.remaining)} still due.`
          : 'Payment recorded. This period is paid in full.',
      )
      onSaved()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment · {period.label}</DialogTitle>
          <DialogDescription>
            Fee {formatMoney(period.amount)}. Partial payments are allowed; overpayment is refused
            by the database.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-4">
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-player">Player</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger id="payment-player">
                  <SelectValue placeholder="Choose a player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {playerId ? (
              <p className="text-xs text-text-muted">
                Paid so far {formatMoney(paid)} · remaining {formatMoney(remaining)}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-amount">Amount (PHP)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-date">Paid on</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-method">Method</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {PAYMENT_METHOD_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onOpenChange} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!playerId}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VoidPaymentDialog({
  payment,
  playerName,
  onOpenChange,
  onVoided,
}: {
  payment: TrainingPaymentRecord
  playerName: string
  onOpenChange: () => void
  onVoided: () => void
}) {
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleVoid() {
    setError(null)

    if (reason.trim().length < 3) {
      setError('Give a reason of at least three characters.')
      return
    }

    setSubmitting(true)

    try {
      await voidTrainingPayment(payment.id, reason.trim())
      toast.success('Payment voided. The row and its history are kept.')
      onVoided()
    } catch (voidError) {
      setError(errorMessage(voidError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this payment?</DialogTitle>
          <DialogDescription>
            {playerName} · {formatMoney(payment.amount)} · {formatDate(payment.paid_on)}. The row is
            never deleted; it stays visible as voided with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Label htmlFor="void-reason">Reason</Label>
          <Textarea
            id="void-reason"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onOpenChange} disabled={submitting}>
            Keep payment
          </Button>
          <Button variant="danger" loading={submitting} onClick={() => void handleVoid()}>
            Void payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
