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
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/features/auth/api'
import { isIsoDate } from '@/features/players/validation'
import { formatMoney } from '@/features/training/money'

import { createTournament, uploadTournamentPoster } from './api'
import { TOURNAMENT_POSTER_ACCEPT, validateTournamentPoster } from './posters'
import type { TournamentRecord } from './types'
import { tournamentFormSchema, type TournamentFormValues } from './validation'

interface TournamentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (tournament: TournamentRecord) => void
}

type FieldErrors = Partial<Record<keyof TournamentFormValues, string>>

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)

  return local.toISOString().slice(0, 10)
}

export function TournamentFormDialog({ open, onOpenChange, onCreated }: TournamentFormDialogProps) {
  const [name, setName] = React.useState('')
  const [startsOn, setStartsOn] = React.useState(todayIso)
  const [endsOn, setEndsOn] = React.useState(todayIso)
  const [venue, setVenue] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [deadline, setDeadline] = React.useState('')
  const [fee, setFee] = React.useState('0')
  const [posterFile, setPosterFile] = React.useState<File | null>(null)
  const [posterError, setPosterError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  function handlePosterChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setPosterFile(null)
      setPosterError(null)
      return
    }

    setPosterError(validateTournamentPoster(file))
    setPosterFile(file)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = tournamentFormSchema.safeParse({
      name,
      starts_on: startsOn,
      ends_on: endsOn,
      venue: venue.trim() === '' ? null : venue,
      description: description.trim() === '' ? null : description,
      registration_deadline: deadline === '' ? null : deadline,
      entrance_fee: fee.trim() === '' ? '0' : fee,
    })

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}

      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !(field in fieldErrors)) {
          fieldErrors[field as keyof TournamentFormValues] = issue.message
        }
      }

      setErrors(fieldErrors)
      return
    }

    if (posterError) return

    let registrationDeadline: string | null = null

    if (parsed.data.registration_deadline) {
      const parsedDeadline = new Date(parsed.data.registration_deadline)
      if (Number.isNaN(parsedDeadline.getTime())) {
        setErrors({ registration_deadline: 'Choose a valid deadline.' })
        return
      }
      registrationDeadline = parsedDeadline.toISOString()
    }

    setErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const saved = await createTournament({
        name: parsed.data.name,
        starts_on: parsed.data.starts_on,
        ends_on: parsed.data.ends_on,
        venue: parsed.data.venue,
        description: parsed.data.description,
        registration_deadline: registrationDeadline,
        entrance_fee: parsed.data.entrance_fee,
      })

      if (posterFile) {
        try {
          await uploadTournamentPoster(saved.id, posterFile)
        } catch (posterUploadError) {
          toast.error(
            `${saved.name} was created, but the poster could not be uploaded: ${errorMessage(
              posterUploadError,
            )}`,
          )
        }
      }

      toast.success(`${saved.name} created as a draft.`)
      onCreated(saved)
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
          <DialogTitle>Create a tournament</DialogTitle>
          <DialogDescription>
            It starts as a draft, visible only to tournament staff. Add events, then publish it for
            the club.
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

            <FormField id="tournament-name" label="Name" required error={errors.name}>
              {(field) => (
                <Input
                  {...field}
                  value={name}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Club Championship 2026"
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="tournament-start" label="Starts on" required error={errors.starts_on}>
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={startsOn}
                    onChange={(event) => setStartsOn(event.target.value)}
                  />
                )}
              </FormField>

              <FormField id="tournament-end" label="Ends on" required error={errors.ends_on}>
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={endsOn}
                    min={isIsoDate(startsOn) ? startsOn : undefined}
                    onChange={(event) => setEndsOn(event.target.value)}
                  />
                )}
              </FormField>
            </div>

            <FormField id="tournament-venue" label="Venue" error={errors.venue}>
              {(field) => (
                <Input
                  {...field}
                  value={venue}
                  maxLength={160}
                  autoComplete="off"
                  placeholder="Club courts"
                  onChange={(event) => setVenue(event.target.value)}
                />
              )}
            </FormField>

            <FormField
              id="tournament-fee"
              label="Entrance fee (per player)"
              error={errors.entrance_fee}
              description={`Charged to every participant. Use 0 for a free tournament.${
                fee.trim() === '' ? '' : ` Current: ${formatMoney(Number(fee) || 0)}.`
              }`}
            >
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  inputMode="decimal"
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                />
              )}
            </FormField>

            <FormField
              id="tournament-poster"
              label="Poster"
              error={posterError ?? undefined}
              description="Optional. PNG, JPEG, or WebP, 5 MB or smaller. You can replace it later while the tournament is not archived."
            >
              {(field) => (
                <Input
                  {...field}
                  type="file"
                  accept={TOURNAMENT_POSTER_ACCEPT}
                  onChange={handlePosterChange}
                />
              )}
            </FormField>

            <FormField
              id="tournament-deadline"
              label="Registration deadline"
              error={errors.registration_deadline}
              description="Optional. After this time, published tournaments stop accepting entries."
            >
              {(field) => (
                <Input
                  {...field}
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              )}
            </FormField>

            <FormField
              id="tournament-description"
              label="Description"
              error={errors.description}
              description="Optional notes for players: format, fees, or schedule."
            >
              {(field) => (
                <Textarea
                  {...field}
                  value={description}
                  maxLength={2000}
                  onChange={(event) => setDescription(event.target.value)}
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
              Create draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
