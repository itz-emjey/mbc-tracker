import { AlertTriangle, Link2, UserPlus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  approveRegistration,
  ASSIGNABLE_ROLES,
  errorMessage,
  ROLE_DESCRIPTIONS,
  type RegistrationRequestSummary,
  type UnlinkedPlayer,
} from '@/features/auth/api'
import { ROLE_LABELS, type Role } from '@/features/auth/types'

interface ApproveRegistrationDialogProps {
  request: RegistrationRequestSummary | null
  players: readonly UnlinkedPlayer[]
  onOpenChange: (open: boolean) => void
  onApproved: () => void
}

type PlayerMode = 'create' | 'link'

export function ApproveRegistrationDialog({
  request,
  players,
  onOpenChange,
  onApproved,
}: ApproveRegistrationDialogProps) {
  const [roles, setRoles] = React.useState<Role[]>(['player'])
  const [playerMode, setPlayerMode] = React.useState<PlayerMode>('create')
  const [playerId, setPlayerId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  function toggleRole(role: Role) {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    )
  }

  async function handleApprove() {
    if (!request) return

    if (roles.length === 0) {
      setError('Choose at least one role.')
      return
    }

    if (playerMode === 'link' && !playerId) {
      setError('Choose the player record to link.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const result = await approveRegistration(
        request.id,
        roles,
        playerMode === 'link' ? playerId : null,
      )

      if (result.already_processed) {
        toast.info(`${request.full_name} was already approved.`)
      } else {
        toast.success(`${request.full_name} approved with 1,000 starting SP.`)
      }

      onApproved()
      onOpenChange(false)
    } catch (approveError) {
      setError(errorMessage(approveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>Approve {request.full_name}</DialogTitle>
              <DialogDescription>
                {request.email} · Requested{' '}
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                  new Date(request.requested_at),
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex flex-col gap-5">
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-text-muted">{error}</p>
                </div>
              ) : null}

              <fieldset>
                <legend className="text-[13px] font-medium text-text">Roles</legend>
                <p className="mt-1 text-xs text-text-muted">
                  Every account can hold several roles. The starter Player role is selected by
                  default.
                </p>

                <div className="mt-2 flex flex-col gap-2">
                  {ASSIGNABLE_ROLES.map((role) => (
                    <label
                      key={role}
                      className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-border bg-surface-2 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-border accent-accent"
                        checked={roles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text">
                          {ROLE_LABELS[role]}
                        </span>
                        <span className="block text-xs leading-relaxed text-text-muted">
                          {ROLE_DESCRIPTIONS[role]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {roles.includes('super_admin') ? (
                  <p className="mt-2 text-xs leading-relaxed text-warning">
                    Super Admin can approve accounts and change access. Grant it only when intended.
                  </p>
                ) : null}
              </fieldset>

              <fieldset>
                <legend className="text-[13px] font-medium text-text">Player record</legend>
                <p className="mt-1 text-xs text-text-muted">
                  Create a new player record, or link an existing unlinked record. Approval adds
                  exactly one 1,000 SP starting transaction.
                </p>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2.5">
                    <input
                      type="radio"
                      name="player-mode"
                      className="mt-0.5 size-4 accent-accent"
                      checked={playerMode === 'create'}
                      onChange={() => setPlayerMode('create')}
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                        <UserPlus className="size-3.5" aria-hidden="true" />
                        Create new
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        Uses the registered name.
                      </span>
                    </span>
                  </label>

                  <label
                    className={
                      players.length === 0
                        ? 'flex cursor-not-allowed items-start gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2.5 opacity-60'
                        : 'flex cursor-pointer items-start gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2.5'
                    }
                  >
                    <input
                      type="radio"
                      name="player-mode"
                      className="mt-0.5 size-4 accent-accent"
                      checked={playerMode === 'link'}
                      disabled={players.length === 0}
                      onChange={() => setPlayerMode('link')}
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                        <Link2 className="size-3.5" aria-hidden="true" />
                        Link existing
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {players.length === 0
                          ? 'No unlinked player records.'
                          : `${players.length} available.`}
                      </span>
                    </span>
                  </label>
                </div>

                {playerMode === 'link' ? (
                  <FormField
                    id="approve-player"
                    label="Unlinked player"
                    description="Only active player records without an account are shown."
                    className="mt-3"
                  >
                    {(field) => (
                      <Select value={playerId} onValueChange={setPlayerId}>
                        <SelectTrigger {...field}>
                          <SelectValue placeholder="Choose a player record" />
                        </SelectTrigger>
                        <SelectContent>
                          {players.map((player) => (
                            <SelectItem key={player.id} value={player.id}>
                              {player.full_name}
                              {player.gender ? ` · ${player.gender}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                ) : null}
              </fieldset>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={() => void handleApprove()} loading={submitting}>
                Approve account
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
