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

import { createTournamentEvent } from './api'
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  TOURNAMENT_FORMATS,
  type Discipline,
  type TournamentEventRecord,
  type TournamentFormat,
} from './types'
import { eventFormSchema, type EventFormValues } from './validation'

interface EventFormDialogProps {
  open: boolean
  tournamentId: string
  usedDisciplines: readonly Discipline[]
  onOpenChange: (open: boolean) => void
  onCreated: (event: TournamentEventRecord) => void
}

type FieldErrors = Partial<Record<keyof EventFormValues, string>>

export function EventFormDialog({
  open,
  tournamentId,
  usedDisciplines,
  onOpenChange,
  onCreated,
}: EventFormDialogProps) {
  const availableDisciplines = DISCIPLINES.filter(
    (discipline) => !usedDisciplines.includes(discipline),
  )
  const [discipline, setDiscipline] = React.useState<Discipline>(
    availableDisciplines[0] ?? 'singles',
  )
  const [format, setFormat] = React.useState<TournamentFormat>('single_elimination')
  const [maxEntries, setMaxEntries] = React.useState('8')
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = eventFormSchema.safeParse({
      discipline,
      format,
      max_entries: maxEntries,
    })

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}

      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !(field in fieldErrors)) {
          fieldErrors[field as keyof EventFormValues] = issue.message
        }
      }

      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const saved = await createTournamentEvent(tournamentId, parsed.data)
      toast.success(`${DISCIPLINE_LABELS[saved.discipline]} added.`)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an event</DialogTitle>
          <DialogDescription>
            One event per discipline. The format and cap can only change while no entries or draw
            exist.
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
              id="event-discipline"
              label="Discipline"
              required
              error={errors.discipline}
              description="Mixed Doubles requires exactly one male and one female player per pair."
            >
              {(field) => (
                <Select
                  value={discipline}
                  onValueChange={(value) => setDiscipline(value as Discipline)}
                >
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDisciplines.map((option) => (
                      <SelectItem key={option} value={option}>
                        {DISCIPLINE_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField id="event-format" label="Format" required error={errors.format}>
              {(field) => (
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as TournamentFormat)}
                >
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOURNAMENT_FORMATS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {FORMAT_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField
              id="event-cap"
              label="Entry cap"
              required
              error={errors.max_entries}
              description="Between 2 and 256 players or teams."
            >
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min={2}
                  max={256}
                  value={maxEntries}
                  onChange={(event) => setMaxEntries(event.target.value)}
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
              Add event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
