import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  Check,
  Lock,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ArenaStatStrip, ArenaPanel } from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FormField } from '@/components/shared/form-field'
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
import {
  closeSeason,
  createSeason,
  decideDeductionBatch,
  listDeductionBatches,
  listSeasonTransitions,
  listSeasons,
  runSeasonTransition,
  startSeason,
} from '@/features/shuttlepower/api'
import type {
  DeductionBatchStatus,
  SeasonDeductionBatchRecord,
  SeasonRecord,
  SeasonStatus,
  SeasonTransitionRecord,
  SeasonTransitionStatus,
} from '@/features/shuttlepower/types'
import { formatDateRange, formatDateTime } from '@/lib/format'

const SEASON_TONES: Record<SeasonStatus, 'neutral' | 'accent' | 'outline'> = {
  scheduled: 'neutral',
  active: 'accent',
  closed: 'outline',
}

const BATCH_TONES: Record<DeductionBatchStatus, 'warning' | 'accent' | 'danger'> = {
  pending: 'warning',
  approved: 'accent',
  rejected: 'danger',
}

const TRANSITION_TONES: Record<SeasonTransitionStatus, 'warning' | 'accent' | 'danger'> = {
  running: 'warning',
  completed: 'accent',
  failed: 'danger',
}

function currentYear(): number {
  return new Date().getFullYear()
}

function CreateSeasonDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const year = currentYear()
  const [label, setLabel] = React.useState(`Season ${year}`)
  const [startsOn, setStartsOn] = React.useState(`${year}-01-01`)
  const [endsOn, setEndsOn] = React.useState(`${year}-12-31`)
  const [labelError, setLabelError] = React.useState<string | undefined>()
  const [dateError, setDateError] = React.useState<string | undefined>()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleCreate() {
    const nextLabel = label.trim()
    let valid = true

    if (nextLabel.length < 4 || nextLabel.length > 40) {
      setLabelError('Use between 4 and 40 characters.')
      valid = false
    } else {
      setLabelError(undefined)
    }

    if (!startsOn || !endsOn || endsOn < startsOn) {
      setDateError('The end date must be on or after the start date.')
      valid = false
    } else {
      setDateError(undefined)
    }

    if (!valid) return

    setFormError(null)
    setSubmitting(true)

    try {
      await createSeason(nextLabel, startsOn, endsOn)
      toast.success(`${nextLabel} was created as a scheduled season.`)
      onCreated()
      onClose()
    } catch (createError) {
      setFormError(errorMessage(createError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a season</DialogTitle>
          <DialogDescription>
            Seasons use Asia/Manila calendar dates and may not overlap. A season starts scheduled;
            activating it is a separate, audited step.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-sm text-text-muted">{formError}</p>
            </div>
          ) : null}

          <FormField id="season-label" label="Label" error={labelError} required>
            {(field) => (
              <Input
                {...field}
                value={label}
                maxLength={40}
                placeholder={`Season ${year}`}
                onChange={(event) => setLabel(event.target.value)}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="season-starts" label="Starts on" error={dateError} required>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                />
              )}
            </FormField>

            <FormField id="season-ends" label="Ends on" required>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                />
              )}
            </FormField>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} loading={submitting}>
            <Plus aria-hidden="true" />
            Create season
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectBatchDialog({
  batch,
  onClose,
  onDecided,
}: {
  batch: SeasonDeductionBatchRecord
  onClose: () => void
  onDecided: () => void
}) {
  const [reason, setReason] = React.useState('')
  const [fieldError, setFieldError] = React.useState<string | undefined>()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleReject() {
    const nextReason = reason.trim()

    if (nextReason.length < 5 || nextReason.length > 500) {
      setFieldError('Use between 5 and 500 characters.')
      return
    }

    setFieldError(undefined)
    setFormError(null)
    setSubmitting(true)

    try {
      await decideDeductionBatch(batch.id, false, nextReason)
      toast.success('The deduction batch was rejected and applies nothing.')
      onDecided()
      onClose()
    } catch (rejectError) {
      setFormError(errorMessage(rejectError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject the {batch.season?.label ?? 'season'} deduction batch</DialogTitle>
          <DialogDescription>
            Rejection is preserved for audit and applies no SP change. A rejected batch never blocks
            the next season. The reason is required.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5">
          {formError ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-sm text-text-muted">{formError}</p>
            </div>
          ) : null}

          <FormField
            id="reject-batch-reason"
            label="Reason"
            description="Shown in the audit trail. Explain why the proposed deductions are not applied."
            error={fieldError}
            required
          >
            {(field) => (
              <Textarea
                {...field}
                value={reason}
                maxLength={500}
                placeholder="For example: the ranking snapshot is under review."
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleReject()} loading={submitting}>
            <X aria-hidden="true" />
            Reject batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminSeasonsPage() {
  const [seasons, setSeasons] = React.useState<SeasonRecord[]>([])
  const [batches, setBatches] = React.useState<SeasonDeductionBatchRecord[]>([])
  const [transitions, setTransitions] = React.useState<SeasonTransitionRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [rejectingBatch, setRejectingBatch] = React.useState<SeasonDeductionBatchRecord | null>(
    null,
  )

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    void Promise.all([listSeasons(), listDeductionBatches(), listSeasonTransitions()])
      .then(([nextSeasons, nextBatches, nextTransitions]) => {
        if (!active) return

        setSeasons(nextSeasons)
        setBatches(nextBatches)
        setTransitions(nextTransitions)
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

  async function handleStart(season: SeasonRecord) {
    try {
      const result = await startSeason(season.id)

      if (result.already_processed) {
        toast.info(`${season.label} is already active.`)
      } else {
        toast.success(`${season.label} is now active.`)
      }

      reload()
    } catch (startError) {
      throw new Error(errorMessage(startError), { cause: startError })
    }
  }

  async function handleClose(season: SeasonRecord) {
    try {
      const result = await closeSeason(season.id)

      if (result.already_processed) {
        toast.info(`${season.label} was already closed.`)
      } else {
        toast.success(
          `${season.label} closed. ${result.snapshots ?? 0} snapshot${
            result.snapshots === 1 ? '' : 's'
          } frozen; ${result.deduction_entries ?? 0} deduction entr${
            result.deduction_entries === 1 ? 'y' : 'ies'
          } proposed.`,
        )
      }

      reload()
    } catch (closeError) {
      throw new Error(errorMessage(closeError), { cause: closeError })
    }
  }

  async function handleApprove(batch: SeasonDeductionBatchRecord) {
    try {
      const result = await decideDeductionBatch(batch.id, true)
      toast.success(
        `Batch approved. ${result.applied ?? 0} player${
          result.applied === 1 ? '' : 's'
        } deducted ${result.applied_total ?? 0} SP in total.`,
      )
      reload()
    } catch (approveError) {
      throw new Error(errorMessage(approveError), { cause: approveError })
    }
  }

  async function handleRunTransition() {
    try {
      const result = await runSeasonTransition(true)

      if (result.status === 'failed') {
        throw new Error(result.error ?? result.reason ?? 'The transition failed again.')
      }

      if (result.status === 'idle') {
        toast.info('No ended season is waiting for a transition.')
      } else if (result.status === 'completed') {
        toast.success('The seasonal transition completed.')
      } else {
        toast.success(`Transition status: ${result.status}.`)
      }

      reload()
    } catch (transitionError) {
      throw new Error(errorMessage(transitionError), { cause: transitionError })
    }
  }

  const activeSeason = seasons.find((season) => season.status === 'active')
  const pendingBatches = batches.filter((batch) => batch.status === 'pending')
  const failedTransitions = transitions.filter((transition) => transition.status === 'failed')

  return (
    <>
      <PageHeader
        kicker="ShuttlePower"
        title="Season management"
        description="Create the calendar season, freeze its snapshot, decide deduction batches, and recover a failed January transition."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/shuttlepower">
              <ArrowLeft aria-hidden="true" />
              ShuttlePower
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not load season data"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <ArenaStatStrip
        className="mt-5"
        stats={[
          {
            label: 'Active season',
            value: activeSeason?.label ?? 'None',
            detail: activeSeason ? 'Results accrue Seasonal SP' : 'Activate a scheduled season',
          },
          {
            label: 'Scheduled',
            value: String(seasons.filter((season) => season.status === 'scheduled').length),
            detail: 'Ready to activate',
          },
          {
            label: 'Pending batches',
            value: String(pendingBatches.length),
            detail: pendingBatches.length > 0 ? 'Awaiting a decision' : 'Nothing to decide',
          },
          {
            label: 'Failed transitions',
            value: String(failedTransitions.length),
            detail: failedTransitions.length > 0 ? 'Needs a forced re-run' : 'Healthy',
          },
        ]}
      />

      <ArenaPanel
        kicker="Calendar"
        title="Seasons"
        description="S2: 12-month seasons in Asia/Manila. A closed season is never reopened."
        className="mt-4"
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="text-[11px] text-text-faint">
            Only one season may be active. Closing freezes the S19 snapshot and creates one pending
            S8 deduction batch.
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            Create season
          </Button>
        </div>

        {loading ? (
          <LoadingState className="p-4" label="Loading seasons" rows={3} />
        ) : seasons.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={CalendarRange}
              title="No season yet"
              description="Create the first calendar season. The transition job also creates one for the current year when it needs a next season."
            />
          </div>
        ) : (
          <Table containerClassName="rounded-none border-0">
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Started</TableHead>
                <TableHead className="hidden md:table-cell">Closed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((season) => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium text-text">{season.label}</TableCell>
                  <TableCell className="whitespace-nowrap text-text-muted">
                    {formatDateRange(season.starts_on, season.ends_on)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={SEASON_TONES[season.status]}>{season.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-xs text-text-muted md:table-cell">
                    {season.started_at ? formatDateTime(season.started_at) : '—'}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-xs text-text-muted md:table-cell">
                    {season.closed_at ? formatDateTime(season.closed_at) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {season.status === 'scheduled' ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="secondary" size="sm">
                              <Play aria-hidden="true" />
                              Start
                            </Button>
                          }
                          title={`Activate ${season.label}?`}
                          description="The season becomes the one active season. Results finalized inside its date range begin accruing Seasonal SP. Replaying activation is a no-op."
                          confirmLabel="Activate season"
                          tone="primary"
                          onConfirm={() => handleStart(season)}
                        />
                      ) : season.status === 'active' ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="secondary" size="sm">
                              <Lock aria-hidden="true" />
                              Close
                            </Button>
                          }
                          title={`Close ${season.label}?`}
                          description="Closing freezes the immutable snapshot, generates one pending deduction batch, and cannot be undone. A closed season is never reopened, and pending batches never block the next season."
                          confirmLabel="Close season"
                          onConfirm={() => handleClose(season)}
                        />
                      ) : (
                        <span className="text-xs text-text-faint">Final</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ArenaPanel>

      <ArenaPanel
        kicker="Deductions"
        title="Season deduction batches"
        description="S8/S9: 40 / 30 / 20 / 10 SP by final position, applied to Current SP only and capped at the available balance."
        className="mt-4"
        bodyClassName="p-0"
      >
        {loading ? (
          <LoadingState className="p-4" label="Loading deduction batches" rows={3} />
        ) : batches.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShieldCheck}
              title="No deduction batch yet"
              description="Closing an active season generates one pending batch from the final snapshot."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {batches.map((batch) => (
              <div key={batch.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text">
                        {batch.season?.label ?? 'Unknown season'}
                      </p>
                      <Badge tone={BATCH_TONES[batch.status]}>{batch.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      Generated {formatDateTime(batch.generated_at)}
                      {batch.decided_at ? ` · decided ${formatDateTime(batch.decided_at)}` : ''}
                      {batch.rejection_reason ? ` · ${batch.rejection_reason}` : ''}
                    </p>
                  </div>

                  {batch.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRejectingBatch(batch)}
                      >
                        <X aria-hidden="true" />
                        Reject
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button size="sm">
                            <Check aria-hidden="true" />
                            Approve
                          </Button>
                        }
                        title={`Approve the ${batch.season?.label ?? 'season'} deductions?`}
                        description="Each ranked player is deducted once from the latest Current SP, capped at the available balance. The remainder is permanently waived. This cannot be undone."
                        confirmLabel="Approve and apply"
                        tone="primary"
                        onConfirm={() => handleApprove(batch)}
                      />
                    </div>
                  ) : null}
                </div>

                {batch.entries.length === 0 ? (
                  <p className="mt-3 text-xs text-text-faint">
                    This batch has no proposed entries.
                  </p>
                ) : (
                  <Table className="mt-3" containerClassName="rounded-md border border-border">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Position</TableHead>
                        <TableHead className="text-right">Tier</TableHead>
                        <TableHead className="text-right">Proposed</TableHead>
                        <TableHead className="text-right">Applied</TableHead>
                        <TableHead className="text-right">Waived</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-text">
                            {entry.player?.full_name ?? entry.player_id}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                            {entry.position}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                            {entry.tier}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text">
                            {entry.proposed_amount}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                            {entry.applied_amount ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                            {entry.waived_amount ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        )}
      </ArenaPanel>

      <ArenaPanel
        kicker="Recovery"
        title="Season transitions"
        description="S20: the scheduled job runs at 00:05 Asia/Manila and retries every 15 minutes. A failed transition can be forced here."
        className="mt-4"
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="text-[11px] text-text-faint">
            Each attempt is checkpointed. A forced re-run resumes the same transition instead of
            creating a second one.
          </p>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="secondary">
                <RefreshCw aria-hidden="true" />
                Run transition now
              </Button>
            }
            title="Run the seasonal transition now?"
            description="The job closes any active season whose end date has passed, freezes its snapshot, creates a deduction batch, activates the next season, and records checkpoints. If nothing is due it is a no-op."
            confirmLabel="Run transition"
            tone="primary"
            onConfirm={handleRunTransition}
          />
        </div>

        {loading ? (
          <LoadingState className="p-4" label="Loading transitions" rows={3} />
        ) : transitions.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={RefreshCw}
              title="No transition has run"
              description="The first transition appears after a season ends. A healthy run completes and needs no action."
            />
          </div>
        ) : (
          <Table containerClassName="rounded-none border-0">
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="hidden md:table-cell">Started</TableHead>
                <TableHead className="hidden md:table-cell">Completed</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transitions.map((transition) => (
                <TableRow key={transition.id}>
                  <TableCell className="font-medium text-text">
                    {transition.season?.label ?? transition.season_id}
                  </TableCell>
                  <TableCell>
                    <Badge tone={TRANSITION_TONES[transition.status]}>{transition.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-text-muted">
                    {transition.attempts}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-xs text-text-muted md:table-cell">
                    {formatDateTime(transition.started_at)}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-xs text-text-muted md:table-cell">
                    {transition.completed_at ? formatDateTime(transition.completed_at) : '—'}
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate text-xs text-danger"
                    title={transition.last_error ?? undefined}
                  >
                    {transition.last_error ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {transition.status === 'completed' ? (
                        <span className="text-xs text-text-faint">Done</span>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="secondary">
                              <RefreshCw aria-hidden="true" />
                              Re-run
                            </Button>
                          }
                          title="Force this transition to run again?"
                          description="The retry limit is cleared and the same transition resumes from its last checkpoint. Use this after fixing the cause shown in the last error."
                          confirmLabel="Force re-run"
                          tone="primary"
                          onConfirm={handleRunTransition}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ArenaPanel>

      {createOpen ? (
        <CreateSeasonDialog onClose={() => setCreateOpen(false)} onCreated={reload} />
      ) : null}

      {rejectingBatch ? (
        <RejectBatchDialog
          batch={rejectingBatch}
          onClose={() => setRejectingBatch(null)}
          onDecided={reload}
        />
      ) : null}
    </>
  )
}
