import { AlertTriangle } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

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
  ASSIGNABLE_ROLES,
  errorMessage,
  ROLE_DESCRIPTIONS,
  setProfileRoles,
  type MemberSummary,
} from '@/features/auth/api'
import { ROLE_LABELS, type Role } from '@/features/auth/types'

interface EditRolesDialogProps {
  member: MemberSummary | null
  /** Prevents a Super Admin from removing their own final admin role in the UI. */
  isSelf?: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EditRolesDialog({
  member,
  isSelf = false,
  onOpenChange,
  onSaved,
}: EditRolesDialogProps) {
  const [roles, setRoles] = React.useState<Role[]>(member?.roles ?? ['player'])
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  function toggleRole(role: Role) {
    if (isSelf && role === 'super_admin' && roles.includes('super_admin')) return

    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    )
  }

  async function handleSave() {
    if (!member) return

    if (roles.length === 0) {
      setError('Choose at least one role.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const result = await setProfileRoles(member.id, roles)

      if (result.changed) {
        toast.success(`${member.full_name} now has ${result.roles.length} role(s).`)
      } else {
        toast.info('No role changes to save.')
      }

      onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {member ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit roles for {member.full_name}</DialogTitle>
              <DialogDescription>
                Roles combine. Set every role this account should hold; saving replaces the current
                set.
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

                <div className="mt-2 flex flex-col gap-2">
                  {ASSIGNABLE_ROLES.map((role) => {
                    const locked = isSelf && role === 'super_admin' && roles.includes(role)

                    return (
                      <label
                        key={role}
                        className={
                          locked
                            ? 'flex cursor-not-allowed items-start gap-2.5 rounded-sm border border-border bg-surface-2 px-3 py-2.5 opacity-70'
                            : 'flex cursor-pointer items-start gap-2.5 rounded-sm border border-border bg-surface-2 px-3 py-2.5'
                        }
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border accent-accent"
                          checked={roles.includes(role)}
                          disabled={locked}
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
                    )
                  })}
                </div>

                {isSelf ? (
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    You cannot remove your own Super Admin role.
                  </p>
                ) : null}

                {roles.includes('super_admin') ? (
                  <p className="mt-2 text-xs leading-relaxed text-warning">
                    Super Admin can approve accounts and change access. Grant it only when intended.
                  </p>
                ) : null}
              </fieldset>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} loading={submitting}>
                Save roles
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
