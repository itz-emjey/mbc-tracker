import { ImagePlus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/features/auth/api'
import { formatMoney } from '@/features/training/money'

import {
  removeTournamentPoster,
  setTournamentEntranceFee,
  tournamentPosterUrl,
  uploadTournamentPoster,
} from './api'
import { TOURNAMENT_POSTER_ACCEPT, validateTournamentPoster } from './posters'
import type { TournamentRecord } from './types'

interface TournamentSettingsProps {
  tournament: TournamentRecord
  onChanged: () => void
}

/**
 * Staff controls for the poster and, while the tournament is still a draft, the
 * entrance fee. The database refuses fee changes once entries exist.
 */
export function TournamentSettings({ tournament, onChanged }: TournamentSettingsProps) {
  const [uploading, setUploading] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const [posterError, setPosterError] = React.useState<string | null>(null)
  const [fee, setFee] = React.useState(String(tournament.entrance_fee))
  const [lastFee, setLastFee] = React.useState(tournament.entrance_fee)
  const [feeError, setFeeError] = React.useState<string | null>(null)
  const [savingFee, setSavingFee] = React.useState(false)

  // Re-sync the input when the saved fee changes, without an effect.
  if (tournament.entrance_fee !== lastFee) {
    setLastFee(tournament.entrance_fee)
    setFee(String(tournament.entrance_fee))
  }

  const posterUrl = tournamentPosterUrl(tournament.poster_path)
  const feeEditable = tournament.status === 'draft'

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    const problem = validateTournamentPoster(file)

    if (problem) {
      setPosterError(problem)
      return
    }

    setPosterError(null)
    setUploading(true)

    try {
      await uploadTournamentPoster(tournament.id, file, tournament.poster_path)
      toast.success('Poster saved.')
      onChanged()
    } catch (uploadError) {
      setPosterError(errorMessage(uploadError))
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!tournament.poster_path) return

    setRemoving(true)
    setPosterError(null)

    try {
      await removeTournamentPoster(tournament.id, tournament.poster_path)
      toast.success('Poster removed.')
      onChanged()
    } catch (removeError) {
      setPosterError(errorMessage(removeError))
    } finally {
      setRemoving(false)
    }
  }

  async function handleFee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(fee)

    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
      setFeeError('Enter a fee between 0 and 1,000,000.')
      return
    }

    setFeeError(null)
    setSavingFee(true)

    try {
      await setTournamentEntranceFee(tournament.id, amount)
      toast.success('Entrance fee updated.')
      onChanged()
    } catch (feeSaveError) {
      setFeeError(errorMessage(feeSaveError))
    } finally {
      setSavingFee(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Poster and entrance fee</CardTitle>
        <CardDescription>
          {feeEditable
            ? 'The poster can change until the tournament is archived. The fee can change only while this is a draft with no entries.'
            : 'The fee is fixed now that the tournament is published. The poster can still change until it is archived.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt="Current tournament poster"
              className="h-28 w-24 rounded-sm border border-border object-cover"
            />
          ) : (
            <div className="flex h-28 w-24 items-center justify-center rounded-sm border border-dashed border-border text-text-faint">
              <ImagePlus className="size-6" aria-hidden="true" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="tournament-poster-replace" className="text-sm font-medium text-text">
              {posterUrl ? 'Replace poster' : 'Add a poster'}
            </label>
            <Input
              id="tournament-poster-replace"
              type="file"
              accept={TOURNAMENT_POSTER_ACCEPT}
              disabled={uploading || tournament.status === 'archived'}
              onChange={(event) => void handleUpload(event)}
            />
            {posterUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => void handleRemove()}
                loading={removing}
                disabled={uploading}
              >
                <Trash2 aria-hidden="true" />
                Remove poster
              </Button>
            ) : null}
            {posterError ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {posterError}
              </p>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={(event) => void handleFee(event)}
          className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="tournament-fee-edit" className="text-sm font-medium text-text">
              Entrance fee (per player)
            </label>
            <Input
              id="tournament-fee-edit"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              inputMode="decimal"
              value={fee}
              disabled={!feeEditable || savingFee}
              onChange={(event) => setFee(event.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-text-faint">
              Current:{' '}
              {Number(tournament.entrance_fee) === 0
                ? 'Free'
                : `${formatMoney(tournament.entrance_fee)} per player`}
            </p>
            {feeError ? (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {feeError}
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="secondary" loading={savingFee} disabled={!feeEditable}>
            Save fee
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
