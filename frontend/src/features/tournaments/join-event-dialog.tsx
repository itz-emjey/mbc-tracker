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
import type { FriendEntry, PlayerRecord } from '@/features/players/types'
import { formatMoney } from '@/features/training/money'

import { joinTournamentEvent } from './api'
import { DISCIPLINE_LABELS, type TournamentEventRecord, type TournamentRecord } from './types'

interface JoinEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: TournamentEventRecord
  tournament: TournamentRecord
  currentPlayer: PlayerRecord
  friends: readonly FriendEntry[]
  onJoined: () => void
}

type PartnerMode = 'club' | 'guest'

/**
 * Player self-entry. Singles registers immediately. Doubles requires a partner:
 * a club friend receives an invitation and the entry appears only after they
 * accept, while a guest is recorded as free text on this entry.
 */
export function JoinEventDialog({
  open,
  onOpenChange,
  event,
  tournament,
  currentPlayer,
  friends,
  onJoined,
}: JoinEventDialogProps) {
  const doubles = event.discipline !== 'singles'
  const acceptedFriends = friends.filter((friend) => friend.status === 'accepted')
  const [mode, setMode] = React.useState<PartnerMode>(acceptedFriends.length > 0 ? 'club' : 'guest')
  const [partnerId, setPartnerId] = React.useState('')
  const [guestName, setGuestName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const fee = Number(tournament.entrance_fee)
  const total = doubles ? fee * 2 : fee

  async function handleSubmit(event_: React.FormEvent<HTMLFormElement>) {
    event_.preventDefault()
    setError(null)

    if (doubles && mode === 'club' && partnerId === '') {
      setError('Choose a club partner from your accepted friends.')
      return
    }

    if (doubles && mode === 'guest' && guestName.trim() === '') {
      setError('Enter the guest partner’s name.')
      return
    }

    setSubmitting(true)

    try {
      const outcome = await joinTournamentEvent(
        event.id,
        doubles && mode === 'club' ? partnerId : null,
        doubles && mode === 'guest' ? guestName.trim() : null,
      )

      if (outcome.status === 'pending_partner') {
        toast.success('Invitation sent. The entry exists once your partner accepts.')
      } else {
        toast.success('You are registered for this event.')
      }

      onJoined()
      onOpenChange(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Join {DISCIPLINE_LABELS[event.discipline]}</DialogTitle>
          <DialogDescription>
            {fee === 0
              ? 'This tournament is free to enter.'
              : `${formatMoney(fee)} per player${
                  doubles ? `, ${formatMoney(total)} for the team` : ''
                }. Staff confirm each payment before the draw.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(formEvent) => void handleSubmit(formEvent)} noValidate>
          <div className="mt-5 flex flex-col gap-5">
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <div className="rounded-sm border border-border bg-surface-2 px-3 py-2.5">
              <p className="text-xs uppercase tracking-[0.06em] text-text-faint">Your entry</p>
              <p className="mt-1 text-sm font-medium text-text">
                {currentPlayer.full_name}
                <span className="ml-2 font-mono text-xs font-normal text-text-faint">
                  {currentPlayer.player_code}
                </span>
              </p>
            </div>

            {doubles ? (
              <>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-text">Partner</legend>

                  <label className="flex items-start gap-2 rounded-sm border border-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="partner-mode"
                      value="club"
                      checked={mode === 'club'}
                      onChange={() => setMode('club')}
                      className="mt-0.5"
                      disabled={acceptedFriends.length === 0}
                    />
                    <span>
                      <span className="font-medium text-text">Club partner</span>
                      <span className="block text-xs text-text-muted">
                        {acceptedFriends.length === 0
                          ? 'Add a friend from your profile first.'
                          : 'They receive an invitation and must accept before the entry exists.'}
                      </span>
                    </span>
                  </label>

                  {mode === 'club' && acceptedFriends.length > 0 ? (
                    <div>
                      <label htmlFor="join-partner" className="sr-only">
                        Club partner
                      </label>
                      <Select value={partnerId} onValueChange={setPartnerId}>
                        <SelectTrigger id="join-partner" className="w-full">
                          <SelectValue placeholder="Choose a friend…" />
                        </SelectTrigger>
                        <SelectContent>
                          {acceptedFriends.map((friend) => (
                            <SelectItem key={friend.player.id} value={friend.player.id}>
                              {friend.player.full_name} ({friend.player.player_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <label className="flex items-start gap-2 rounded-sm border border-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="partner-mode"
                      value="guest"
                      checked={mode === 'guest'}
                      onChange={() => setMode('guest')}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-text">Guest partner</span>
                      <span className="block text-xs text-text-muted">
                        No club account needed. The name is kept on this entry only.
                      </span>
                    </span>
                  </label>
                </fieldset>

                {mode === 'guest' ? (
                  <FormField
                    id="guest-partner-name"
                    label="Guest partner name"
                    required
                    description="Up to 120 characters. The database infers their gender from the event."
                  >
                    {(field) => (
                      <Input
                        {...field}
                        value={guestName}
                        maxLength={120}
                        autoComplete="off"
                        placeholder="Guest partner’s full name"
                        onChange={(changeEvent) => setGuestName(changeEvent.target.value)}
                      />
                    )}
                  </FormField>
                ) : null}
              </>
            ) : null}
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
              Join event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
