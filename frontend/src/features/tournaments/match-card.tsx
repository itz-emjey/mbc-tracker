import { Check } from 'lucide-react'

import { ArenaAvatar } from '@/components/arena/arena-ui'
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

/** A slot that is still waiting on an earlier result. */
function isUnresolved(name: string): boolean {
  return name === 'To be decided' || name.startsWith('Winner of ') || name.startsWith('Loser of ')
}

function SideRow({ name, winner }: { name: string; winner: boolean }) {
  const unresolved = isUnresolved(name)

  return (
    <div
      className={cn('flex items-center gap-2 rounded-sm px-1.5 py-1', winner && 'bg-accent-soft')}
    >
      {unresolved ? (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-border text-[11px] text-text-faint"
        >
          ?
        </span>
      ) : (
        <ArenaAvatar name={name} size="sm" tone={winner ? 'accent' : 'neutral'} />
      )}

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          unresolved ? 'text-text-faint' : winner ? 'font-semibold text-text' : 'text-text-muted',
        )}
        title={name}
      >
        {name}
      </span>

      {winner ? <Check className="size-3.5 shrink-0 text-accent" aria-label="Winner" /> : null}
    </div>
  )
}

/** One clash in the draw: two sides, the scoreline, and the result action. */
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
  const decided = match.status === 'completed'

  return (
    <div
      className={cn(
        'rounded-md border bg-surface-1 p-2.5',
        decided ? 'border-border-strong' : 'border-border',
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">
          Match {match.position}
        </span>
        <Badge tone={statusTone(match.status)}>{statusLabel(match.status)}</Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <SideRow name={homeName} winner={match.winner_entry_id === match.home_entry_id} />
        <SideRow name={awayName} winner={match.winner_entry_id === match.away_entry_id} />
      </div>

      {scores ? (
        <p className="mt-1.5 flex items-center gap-1.5 border-t border-border pt-1.5 font-mono text-[11px] tabular-nums text-text-muted">
          <span className="text-[9px] uppercase tracking-[0.08em] text-text-faint">Score</span>
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
