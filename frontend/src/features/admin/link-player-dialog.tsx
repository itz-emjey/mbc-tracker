import { AlertTriangle, Link2 } from 'lucide-react'
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
import { errorMessage, type MemberSummary, type UnlinkedPlayer } from '@/features/auth/api'
import { linkPlayerAccount } from '@/features/players/api'

interface LinkPlayerDialogProps {
  member: MemberSummary | null
  players: readonly UnlinkedPlayer[]
  onOpenChange: (open: boolean) => void
  onLinked: () => void
}

export function LinkPlayerDialog({
  member,
  players,
  onOpenChange,
  onLinked,
}: LinkPlayerDialogProps) {
  const [playerId, setPlayerId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleLink() {
    if (!member) return

    if (!playerId) {
      setError('Choose the player record to link.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await linkPlayerAccount(member.id, playerId)
      toast.success(`${member.full_name} is now linked to the selected player record.`)
      onLinked()
      onOpenChange(false)
    } catch (linkError) {
      setError(errorMessage(linkError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent>
        {member ? (
          <>
            <DialogHeader>
              <DialogTitle>Link a player record</DialogTitle>
              <DialogDescription>
                Connect {member.full_name}&apos;s approved account to one unlinked player record.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex flex-col gap-4">
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

              {players.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Every active player record already has an account. Add a player first if this
                  account needs a new record.
                </p>
              ) : (
                <FormField
                  id="link-player"
                  label="Player record"
                  description="Only active records without an account are shown."
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
              )}

              <p className="text-xs leading-relaxed text-text-muted">
                Linking does not change roles or SP. One account can hold at most one player record.
              </p>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleLink()}
                loading={submitting}
                disabled={players.length === 0}
              >
                <Link2 aria-hidden="true" />
                Link player
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
