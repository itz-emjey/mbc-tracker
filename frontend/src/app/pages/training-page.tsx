import { CalendarCheck, Plus, UserCheck } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { SectionHeading } from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
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
  createTrainingSession,
  listTrainingAttendance,
  listTrainingSessions,
  markTrainingAttendance,
  setTrainingSessionStatus,
} from '@/features/training/api'
import { attendedCount, countAttendance } from '@/features/training/money'
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  TRAINING_STAFF_ROLES,
  type AttendanceStatus,
  type TrainingAttendanceRecord,
  type TrainingSessionRecord,
} from '@/features/training/types'
import { localDateTimeToIso, sessionFormSchema } from '@/features/training/validation'
import { formatDateTime } from '@/lib/format'
import { statusLabel, statusTone } from '@/lib/status'

function statusFor(
  attendance: readonly TrainingAttendanceRecord[],
  sessionId: string,
  playerId: string | null,
): AttendanceStatus | null {
  if (!playerId) return null

  return (
    attendance.find((row) => row.session_id === sessionId && row.player_id === playerId)?.status ??
    null
  )
}

export function TrainingPage() {
  const { user } = useSession()
  const isStaff = hasAnyRole(user?.roles ?? [], TRAINING_STAFF_ROLES)

  const [sessions, setSessions] = React.useState<TrainingSessionRecord[]>([])
  const [attendance, setAttendance] = React.useState<TrainingAttendanceRecord[]>([])
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [ownPlayer, setOwnPlayer] = React.useState<PlayerRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [formOpen, setFormOpen] = React.useState(false)
  const [attendanceSession, setAttendanceSession] = React.useState<TrainingSessionRecord | null>(
    null,
  )

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextSessions, nextAttendance, nextPlayers] = await Promise.all([
          listTrainingSessions(),
          listTrainingAttendance(),
          listPlayers(),
        ])
        const player = user ? await getPlayerByProfile(user.id) : null

        if (!active) return

        setSessions(nextSessions)
        setAttendance(nextAttendance)
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

  const activePlayers = React.useMemo(
    () =>
      players
        .filter((player) => player.status === 'active')
        .sort((left, right) => left.full_name.localeCompare(right.full_name)),
    [players],
  )

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  const scheduled = sessions.filter((session) => session.status === 'scheduled').length
  const completed = sessions.filter((session) => session.status === 'completed').length
  const myAttendance = attendance.filter(
    (row) => row.player_id === ownPlayer?.id && (row.status === 'present' || row.status === 'late'),
  ).length

  async function changeStatus(session: TrainingSessionRecord, status: 'completed' | 'cancelled') {
    await setTrainingSessionStatus(session.id, status)
    toast.success(status === 'completed' ? 'Session completed.' : 'Session cancelled.')
    reload()
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Training" />
        <LoadingState className="mt-6" label="Loading training" rows={5} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Training" />
        <ErrorState
          className="mt-6"
          title="Could not load training"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        kicker="Training floor"
        title="Training"
        description="Session schedule, attendance, and the record of who showed up."
        stats={[
          { label: 'Sessions', value: String(sessions.length) },
          { label: 'Scheduled', value: String(scheduled) },
          { label: 'Completed', value: String(completed) },
          {
            label: isStaff ? 'Marked rows' : 'Your attendance',
            value: String(isStaff ? attendance.length : myAttendance),
          },
        ]}
        actions={
          isStaff ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" />
              New session
            </Button>
          ) : null
        }
      />

      <div className="mt-6">
        <SectionHeading
          index="01"
          title="Sessions"
          description={
            isStaff
              ? 'Marking attendance is audited. A completed or cancelled session is closed to further marking.'
              : 'Your own attendance appears beside each session.'
          }
        />

        <div className="mt-4">
          {sessions.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No sessions yet"
              description={
                isStaff
                  ? 'Create the first session, then mark attendance.'
                  : 'Training staff have not scheduled a session yet.'
              }
              action={
                isStaff ? (
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus aria-hidden="true" />
                    New session
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table containerClassName="border-border">
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  {isStaff ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const rows = attendance.filter((row) => row.session_id === session.id)
                  const counts = countAttendance(rows)
                  const mine = statusFor(attendance, session.id, ownPlayer?.id ?? null)

                  return (
                    <TableRow key={session.id}>
                      <TableCell className="max-w-64">
                        <p className="truncate font-medium text-text">{session.title}</p>
                        <p className="truncate text-xs text-text-muted">
                          {session.venue ?? 'Venue not set'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-text-muted md:table-cell">
                        {formatDateTime(session.starts_at)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={statusTone(session.status)}>
                          {SESSION_STATUS_LABELS[session.status] ?? statusLabel(session.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-text-muted">
                        {isStaff ? (
                          <span className="tabular-nums">
                            {attendedCount(counts)} of {counts.total} marked
                          </span>
                        ) : mine ? (
                          <Badge
                            tone={
                              mine === 'present'
                                ? 'accent'
                                : mine === 'absent'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {ATTENDANCE_STATUS_LABELS[mine]}
                          </Badge>
                        ) : (
                          <span className="text-text-faint">Not marked</span>
                        )}
                      </TableCell>
                      {isStaff ? (
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {session.status === 'scheduled' ? (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setAttendanceSession(session)}
                                >
                                  <UserCheck aria-hidden="true" />
                                  Attendance
                                </Button>
                                <ConfirmDialog
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      Complete
                                    </Button>
                                  }
                                  title={`Complete ${session.title}?`}
                                  description="Completed sessions stay in history and closed to further attendance marking."
                                  confirmLabel="Complete session"
                                  onConfirm={() => changeStatus(session, 'completed')}
                                />
                                <ConfirmDialog
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      Cancel
                                    </Button>
                                  }
                                  title={`Cancel ${session.title}?`}
                                  description="The session stays in history. Attendance cannot be marked afterwards."
                                  confirmLabel="Cancel session"
                                  tone="danger"
                                  onConfirm={() => changeStatus(session, 'cancelled')}
                                />
                              </>
                            ) : (
                              <span className="text-xs text-text-faint">—</span>
                            )}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {formOpen ? (
        <SessionFormDialog
          open
          onOpenChange={setFormOpen}
          onCreated={() => {
            setFormOpen(false)
            reload()
          }}
        />
      ) : null}

      {attendanceSession ? (
        <AttendanceDialog
          session={attendanceSession}
          players={activePlayers}
          playersById={playersById}
          existing={attendance.filter((row) => row.session_id === attendanceSession.id)}
          onOpenChange={() => setAttendanceSession(null)}
          onSaved={() => {
            setAttendanceSession(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

interface SessionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

function SessionFormDialog({ open, onOpenChange, onCreated }: SessionFormDialogProps) {
  const [values, setValues] = React.useState({
    title: '',
    starts_at: '',
    ends_at: '',
    venue: '',
    notes: '',
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

    const parsed = sessionFormSchema.safeParse({
      title: values.title,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
      venue: values.venue.trim() === '' ? null : values.venue,
      notes: values.notes.trim() === '' ? null : values.notes,
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
      await createTrainingSession({
        title: parsed.data.title,
        starts_at: localDateTimeToIso(parsed.data.starts_at),
        ends_at: localDateTimeToIso(parsed.data.ends_at),
        venue: parsed.data.venue,
        notes: parsed.data.notes,
      })
      toast.success('Session scheduled.')
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
          <DialogTitle>New training session</DialogTitle>
          <DialogDescription>
            Times use your local timezone; the database stores UTC.
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
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                value={values.title}
                onChange={(event) => update('title', event.target.value)}
              />
              {errors.title ? <p className="text-xs text-danger">{errors.title}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="session-starts">Starts</Label>
                <Input
                  id="session-starts"
                  type="datetime-local"
                  value={values.starts_at}
                  onChange={(event) => update('starts_at', event.target.value)}
                />
                {errors.starts_at ? (
                  <p className="text-xs text-danger">{errors.starts_at}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="session-ends">Ends</Label>
                <Input
                  id="session-ends"
                  type="datetime-local"
                  value={values.ends_at}
                  onChange={(event) => update('ends_at', event.target.value)}
                />
                {errors.ends_at ? <p className="text-xs text-danger">{errors.ends_at}</p> : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="session-venue">Venue</Label>
              <Input
                id="session-venue"
                value={values.venue}
                onChange={(event) => update('venue', event.target.value)}
              />
              {errors.venue ? <p className="text-xs text-danger">{errors.venue}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="session-notes">Notes</Label>
              <Textarea
                id="session-notes"
                value={values.notes}
                maxLength={2000}
                onChange={(event) => update('notes', event.target.value)}
              />
              {errors.notes ? <p className="text-xs text-danger">{errors.notes}</p> : null}
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
              Schedule session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface AttendanceDialogProps {
  session: TrainingSessionRecord
  players: readonly PlayerRecord[]
  playersById: ReadonlyMap<string, PlayerRecord>
  existing: readonly TrainingAttendanceRecord[]
  onOpenChange: () => void
  onSaved: () => void
}

function AttendanceDialog({
  session,
  players,
  playersById,
  existing,
  onOpenChange,
  onSaved,
}: AttendanceDialogProps) {
  const [draft, setDraft] = React.useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {}

    for (const player of players) {
      const marked = existing.find((row) => row.player_id === player.id)
      initial[player.id] = marked?.status ?? 'present'
    }

    return initial
  })
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const presentCount = ATTENDANCE_STATUSES.map((status) => ({
    status,
    count: players.filter((player) => draft[player.id] === status).length,
  }))

  async function handleSave() {
    setError(null)
    setSubmitting(true)

    try {
      const entries = players.map((player) => ({
        player_id: player.id,
        status: draft[player.id] ?? 'present',
      }))

      const recorded = await markTrainingAttendance(session.id, entries)
      toast.success(`Attendance saved for ${recorded} player${recorded === 1 ? '' : 's'}.`)
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance · {session.title}</DialogTitle>
          <DialogDescription>
            Every active player is listed. Re-saving updates the marked rows instead of adding new
            ones.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          {players.length === 0 ? (
            <p className="text-sm text-text-muted">
              There are no active player records, so there is nobody to mark.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-sm border border-border">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <span className="truncate text-sm text-text">
                    {playersById.get(player.id)?.full_name ?? player.full_name}
                  </span>
                  <Select
                    value={draft[player.id] ?? 'present'}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        [player.id]: value as AttendanceStatus,
                      }))
                    }
                  >
                    <SelectTrigger
                      className="w-36"
                      aria-label={`Attendance for ${player.full_name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {ATTENDANCE_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-text-muted">
            {presentCount
              .map(
                (entry) => `${entry.count} ${ATTENDANCE_STATUS_LABELS[entry.status].toLowerCase()}`,
              )
              .join(' · ')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onOpenChange} disabled={submitting}>
            Cancel
          </Button>
          <Button
            loading={submitting}
            disabled={players.length === 0}
            onClick={() => void handleSave()}
          >
            Save attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
