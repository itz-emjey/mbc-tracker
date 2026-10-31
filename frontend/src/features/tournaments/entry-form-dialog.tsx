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
import { validateTournamentEntries } from '@/domain/tournament'
import { PLAYER_GENDER_LABELS, type PlayerRecord } from '@/features/players/types'

import { registerTournamentEntry } from './api'
import { entryPlayerIds } from './display'
import {
  DISCIPLINE_LABELS,
  type EntryOutcome,
  type TeamMemberRecord,
  type TournamentEntryRecord,
  type TournamentEventRecord,
} from './types'

interface EntryFormDialogProps {
  open: boolean
  event: TournamentEventRecord
  players: readonly PlayerRecord[]
  entries: readonly TournamentEntryRecord[]
  teamMembers: readonly TeamMemberRecord[]
  onOpenChange: (open: boolean) => void
  onCreated: (outcome: EntryOutcome) => void
}

function playerLabel(player: PlayerRecord): string {
  return player.gender
    ? `${player.full_name} (${PLAYER_GENDER_LABELS[player.gender]})`
    : player.full_name
}

export function EntryFormDialog({
  open,
  event,
  players,
  entries,
  teamMembers,
  onOpenChange,
  onCreated,
}: EntryFormDialogProps) {
  const teamMembersByTeam = React.useMemo(() => {
    const grouped = new Map<string, TeamMemberRecord[]>()

    for (const member of teamMembers) {
      const list = grouped.get(member.team_id) ?? []
      list.push(member)
      grouped.set(member.team_id, list)
    }

    return grouped
  }, [teamMembers])

  const eventEntries = React.useMemo(
    () => entries.filter((entry) => entry.event_id === event.id),
    [entries, event.id],
  )

  const registeredEntries = React.useMemo(
    () => eventEntries.filter((entry) => entry.status === 'registered'),
    [eventEntries],
  )

  const usedPlayerIds = React.useMemo(() => {
    const used = new Set<string>()

    for (const entry of registeredEntries) {
      for (const playerId of entryPlayerIds(entry, teamMembersByTeam)) {
        used.add(playerId)
      }
    }

    return used
  }, [registeredEntries, teamMembersByTeam])

  const availablePlayers = React.useMemo(
    () =>
      players
        .filter((player) => player.status === 'active' && !usedPlayerIds.has(player.id))
        .sort((left, right) => left.full_name.localeCompare(right.full_name)),
    [players, usedPlayerIds],
  )

  const [firstPlayer, setFirstPlayer] = React.useState('')
  const [secondPlayer, setSecondPlayer] = React.useState('')
  const [seed, setSeed] = React.useState('')
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const expectsTwo = event.discipline !== 'singles'

  async function handleSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    setFieldError(null)
    setFormError(null)

    const playerIds = expectsTwo ? [firstPlayer, secondPlayer] : [firstPlayer]

    if (playerIds.some((playerId) => playerId === '')) {
      setFieldError(expectsTwo ? 'Choose both players for this doubles entry.' : 'Choose a player.')
      return
    }

    if (expectsTwo && firstPlayer === secondPlayer) {
      setFieldError('A player cannot partner themselves.')
      return
    }

    let seedValue: number | null = null

    if (seed.trim() !== '') {
      const parsedSeed = Number(seed)
      if (!Number.isInteger(parsedSeed) || parsedSeed < 1) {
        setFieldError('Seeds must be whole numbers starting at 1.')
        return
      }
      seedValue = parsedSeed
    }

    const existingCandidates = registeredEntries.map((entry) => ({
      playerIds: entryPlayerIds(entry, teamMembersByTeam),
      seed: entry.seed,
    }))

    const validation = validateTournamentEntries({
      discipline: event.discipline,
      maxEntries: event.max_entries,
      entries: [...existingCandidates, { playerIds, seed: seedValue }],
      players: players.map((player) => ({ id: player.id, gender: player.gender })),
    })

    if (!validation.valid) {
      setFieldError(validation.errors[0]?.message ?? 'This entry does not satisfy the event rules.')
      return
    }

    setSubmitting(true)

    try {
      const outcome = await registerTournamentEntry(event.id, playerIds, seedValue)
      toast.success('Entry registered.')
      onCreated(outcome)
      onOpenChange(false)
    } catch (submitError) {
      setFormError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an entry</DialogTitle>
          <DialogDescription>
            {DISCIPLINE_LABELS[event.discipline]} · cap {event.max_entries}. Entries are locked once
            the draw is generated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(formEvent) => void handleSubmit(formEvent)} noValidate>
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

            {fieldError ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {fieldError}
              </p>
            ) : null}

            {availablePlayers.length === 0 ? (
              <p className="text-sm text-text-muted">
                Every active player is already in this event. Add or reactivate player records
                first.
              </p>
            ) : null}

            <FormField
              id="entry-player-one"
              label={expectsTwo ? 'Player one' : 'Player'}
              required
              description={
                expectsTwo && event.discipline === 'mixed_doubles'
                  ? 'Mixed Doubles needs one male and one female player.'
                  : undefined
              }
            >
              {(field) => (
                <Select value={firstPlayer} onValueChange={setFirstPlayer}>
                  <SelectTrigger {...field}>
                    <SelectValue placeholder="Choose a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlayers.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {playerLabel(player)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            {expectsTwo ? (
              <FormField id="entry-player-two" label="Player two" required>
                {(field) => (
                  <Select value={secondPlayer} onValueChange={setSecondPlayer}>
                    <SelectTrigger {...field}>
                      <SelectValue placeholder="Choose a partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlayers
                        .filter((player) => player.id !== firstPlayer)
                        .map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {playerLabel(player)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            ) : null}

            <FormField
              id="entry-seed"
              label="Seed"
              description="Optional. Seeds order a seeded draw and must be unique within the event."
            >
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min={1}
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
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
            <Button type="submit" loading={submitting} disabled={availablePlayers.length === 0}>
              Add entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
