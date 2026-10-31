import { Check } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { statusLabel, statusTone } from '@/lib/status'

import type { ResultMode } from './result-form-dialog'
import { formatGameScores } from './results'
import type { MatchGameRecord, MatchRecord } from './types'

export interface MatchCardProps {
  match: MatchRecord
  homeName: string
  awayName: string
  games: readonly MatchGameRecord[]
  canRecord: boolean
  onRecord: (match: MatchRecord, mode: ResultMode) => void
}

function SideRow({ name, winner }: { name: string; winner: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-sm px-1.5 py-1',
        winner && 'bg-accent-soft',
      )}
    >
      <span
        className={cn('truncate text-sm', winner ? 'font-semibold text-text' : 'text-text-muted')}
        title={name}
      >
        {name}
      </span>
      {winner ? <Check className="size-3.5 shrink-0 text-accent" aria-label="Winner" /> : null}
    </div>
  )
}

/** One bracket or round-robin match. Shared by the bracket and schedule views. */
export function MatchCard({
  match,
  homeName,
  awayName,
  games,
  canRecord,
  onRecord,
}: MatchCardProps) {
  const scores = formatGameScores(games)
  const ready = match.home_entry_id !== null && match.away_entry_id !== null

  return (
    <div className="rounded-md border border-border bg-surface-2 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.08em] text-text-faint">
          Match {match.position}
        </span>
        <Badge tone={statusTone(match.status)}>{statusLabel(match.status)}</Badge>
      </div>

      <SideRow name={homeName} winner={match.winner_entry_id === match.home_entry_id} />
      <SideRow name={awayName} winner={match.winner_entry_id === match.away_entry_id} />

      {scores ? (
        <p className="mt-1.5 border-t border-border pt-1.5 text-xs tabular-nums text-text-muted">
          {scores}
        </p>
      ) : null}

      {match.status === 'cancelled' ? (
        <p className="mt-1.5 text-xs text-text-faint">
          Not needed: the winners-bracket finalist won the first final.
        </p>
      ) : null}

      {match.status === 'pending' && match.reset ? (
        <p className="mt-1.5 text-xs text-text-faint">
          Played only if the losers-bracket finalist wins the first final.
        </p>
      ) : null}

      {canRecord && match.status === 'pending' && ready ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2 w-full"
          onClick={() => onRecord(match, 'record')}
        >
          Record result
        </Button>
      ) : null}

      {canRecord && match.status === 'completed' ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => onRecord(match, 'correct')}
        >
          Correct result
        </Button>
      ) : null}
    </div>
  )
}
