import { AlertTriangle } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/features/auth/api'

import { createPlayer, updatePlayer } from './api'
import type { PlayerRecord, PlayerStatus } from './types'
import { PLAYER_STATUS_LABELS, PLAYER_STATUSES } from './types'
import { playerFormSchema, type PlayerFormValues } from './validation'

interface PlayerFormDialogProps {
  open: boolean
  /** `null` means "add a new player". */
  player: PlayerRecord | null
  onOpenChange: (open: boolean) => void
  onSaved: (player: PlayerRecord) => void
}

type GenderValue = 'unspecified' | 'male' | 'female'
type FieldErrors = Partial<Record<keyof PlayerFormValues, string>>

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)

  return local.toISOString().slice(0, 10)
}

export function PlayerFormDialog({ open, player, onOpenChange, onSaved }: PlayerFormDialogProps) {
  const [fullName, setFullName] = React.useState(player?.full_name ?? '')
  const [gender, setGender] = React.useState<GenderValue>(player?.gender ?? 'unspecified')
  const [status, setStatus] = React.useState<PlayerStatus>(player?.status ?? 'active')
  const [joinedOn, setJoinedOn] = React.useState(() => player?.joined_on ?? todayIso())
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = playerFormSchema.safeParse({
      full_name: fullName,
      gender: gender === 'unspecified' ? null : gender,
      status,
      joined_on: joinedOn,
    })

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}

      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !(field in fieldErrors)) {
          fieldErrors[field as keyof PlayerFormValues] = issue.message
        }
      }

      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const saved = player
        ? await updatePlayer(player.id, parsed.data)
        : await createPlayer(parsed.data)

      toast.success(player ? `${saved.full_name} updated.` : `${saved.full_name} added.`)
      onSaved(saved)
      onOpenChange(false)
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
          <DialogTitle>{player ? `Edit ${player.full_name}` : 'Add a player'}</DialogTitle>
          <DialogDescription>
            {player
              ? 'Staff can correct the directory record. Account linking is managed separately.'
              : 'Create a directory record now. An approved account can be linked later.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-5">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-sm text-text-muted">{formError}</p>
              </div>
            ) : null}

            <FormField
              id="player-name"
              label="Full name"
              required
              error={errors.full_name}
              description="The name shown across the club directory."
            >
              {(field) => (
                <Input
                  {...field}
                  value={fullName}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(event) => setFullName(event.target.value)}
                />
              )}
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="player-gender"
                label="Gender"
                description="Optional. Used for mixed or gendered draws later."
              >
                {(field) => (
                  <Select value={gender} onValueChange={(value) => setGender(value as GenderValue)}>
                    <SelectTrigger {...field}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Not specified</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField
                id="player-status"
                label="Status"
                description="Suspended players keep their records and history."
              >
                {(field) => (
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as PlayerStatus)}
                  >
                    <SelectTrigger {...field}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYER_STATUSES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {PLAYER_STATUS_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <FormField
              id="player-joined"
              label="Joined on"
              required
              error={errors.joined_on}
              description="The date the player joined the club."
            >
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={joinedOn}
                  max={todayIso()}
                  onChange={(event) => setJoinedOn(event.target.value)}
                />
              )}
            </FormField>
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
              {player ? 'Save changes' : 'Add player'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
