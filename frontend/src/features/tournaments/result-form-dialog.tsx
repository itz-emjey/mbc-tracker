import { AlertTriangle, Plus, X } from 'lucide-react'
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

import { correctMatchResult, recordMatchResult } from './api'
import type { MatchGameRecord, MatchRecord, ResultOutcome } from './types'
import { parseGameRows, type GameRowInput } from './validation'

export type ResultMode = 'record' | 'correct'

interface ResultFormDialogProps {
  open: boolean
  match: MatchRecord
  homeName: string
  awayName: string
  existingGames: readonly MatchGameRecord[]
  mode: ResultMode
  onOpenChange: (open: boolean) => void
  onSaved: (outcome: ResultOutcome) => void
}

function emptyRows(count = 2): GameRowInput[] {
  return Array.from({ length: count }, () => ({ home_points: '', away_points: '' }))
}

export function ResultFormDialog({
  open,
  match,
  homeName,
  awayName,
  existingGames,
  mode,
  onOpenChange,
  onSaved,
}: ResultFormDialogProps) {
  const [rows, setRows] = React.useState<GameRowInput[]>(() =>
    existingGames.length > 0
      ? existingGames.map((game) => ({
          home_points: String(game.home_points),
          away_points: String(game.away_points),
        }))
      : emptyRows(),
  )
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  function updateRow(index: number, side: 'home_points' | 'away_points', value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [side]: value } : row)),
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed = parseGameRows(rows)

    if (!parsed.valid) {
      setError(parsed.message)
      return
    }

    if (mode === 'correct' && reason.trim() === '') {
      setError('Explain why the result is being corrected.')
      return
    }

    setSubmitting(true)

    try {
      const outcome =
        mode === 'correct'
          ? await correctMatchResult(match.id, parsed.games, reason.trim())
          : await recordMatchResult(match.id, parsed.games)

      toast.success(mode === 'correct' ? 'Result corrected.' : 'Result recorded.')
      onSaved(outcome)
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
          <DialogTitle>{mode === 'correct' ? 'Correct a result' : 'Record a result'}</DialogTitle>
          <DialogDescription>
            {homeName} vs {awayName}. Enter the points in playing order; each game needs a winner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-4">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-sm text-text-muted">{error}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-[3rem_1fr_1fr_2rem] items-center gap-2 text-xs uppercase tracking-[0.06em] text-text-faint">
              <span>Game</span>
              <span className="truncate" title={homeName}>
                {homeName}
              </span>
              <span className="truncate" title={awayName}>
                {awayName}
              </span>
              <span className="sr-only">Remove</span>
            </div>

            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[3rem_1fr_1fr_2rem] items-center gap-2">
                <span className="text-sm text-text-muted">{index + 1}</span>
                <label className="sr-only" htmlFor={`game-${index}-home`}>
                  {homeName} points in game {index + 1}
                </label>
                <Input
                  id={`game-${index}-home`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.home_points}
                  onChange={(event) => updateRow(index, 'home_points', event.target.value)}
                />
                <label className="sr-only" htmlFor={`game-${index}-away`}>
                  {awayName} points in game {index + 1}
                </label>
                <Input
                  id={`game-${index}-away`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.away_points}
                  onChange={(event) => updateRow(index, 'away_points', event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove game ${index + 1}`}
                  disabled={rows.length === 1}
                  onClick={() =>
                    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() =>
                setRows((current) => [...current, { home_points: '', away_points: '' }])
              }
            >
              <Plus aria-hidden="true" />
              Add game
            </Button>

            {mode === 'correct' ? (
              <FormField
                id="correction-reason"
                label="Reason"
                required
                description="Stored in the audit log with the old and new result."
              >
                {(field) => (
                  <Textarea
                    {...field}
                    value={reason}
                    maxLength={1000}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </FormField>
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
              {mode === 'correct' ? 'Save correction' : 'Save result'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
