import { Plus, Swords } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ArenaAvatar, ArenaPanel, ArenaStatStrip } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { arenaRecord } from '@/domain/arena'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import {
  approveFriendlyResult,
  cancelFriendlyChallenge,
  createFriendlyChallenge,
  disputeFriendlyResult,
  listFriendlyMatches,
  respondFriendlyChallenge,
  submitFriendlyResult,
} from '@/features/friendlies/api'
import {
  canCancel,
  canRespond,
  canReviewResult,
  canSubmitResult,
  hoursUntilAutoApproval,
  isOpenFriendly,
  isParticipant,
  opponentOf,
} from '@/features/friendlies/matches'
import {
  FRIENDLY_STATUS_LABELS,
  type FriendlyMatchRecord,
  type FriendlyStatus,
} from '@/features/friendlies/types'
import { getPlayerByProfile, listPlayers } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import { formatDateTime } from '@/lib/format'

function toneFor(status: FriendlyStatus): 'neutral' | 'accent' | 'warning' | 'info' {
  if (status === 'confirmed' || status === 'accepted') return 'accent'
  if (status === 'auto_approved') return 'info'
  if (status === 'pending' || status === 'awaiting_approval' || status === 'disputed') {
    return 'warning'
  }

  return 'neutral'
}

export function FriendlyMatchesPage() {
  const { user } = useSession()
  const isSuperAdmin = hasAnyRole(user?.roles ?? [], ['super_admin'])

  const [matches, setMatches] = React.useState<FriendlyMatchRecord[]>([])
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [ownPlayer, setOwnPlayer] = React.useState<PlayerRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  /** Captured with the data so the deadline copy stays out of render. */
  const [loadedAt, setLoadedAt] = React.useState(0)
  const [challengeOpen, setChallengeOpen] = React.useState(false)
  const [disputeTarget, setDisputeTarget] = React.useState<FriendlyMatchRecord | null>(null)

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextMatches, nextPlayers] = await Promise.all([listFriendlyMatches(), listPlayers()])
        const player = user ? await getPlayerByProfile(user.id) : null

        if (!active) return

        setMatches(nextMatches)
        setPlayers(nextPlayers)
        setOwnPlayer(player)
        setLoadedAt(Date.now())
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [user, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  const names = React.useMemo(
    () => new Map(players.map((player) => [player.id, player.full_name])),
    [players],
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Friendly Matches" />
        <LoadingState className="mt-6" label="Loading friendly matches" rows={4} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Friendly Matches" />
        <ErrorState
          className="mt-6"
          title="Could not load friendly matches"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  const ownMatches = ownPlayer ? matches.filter((match) => isParticipant(match, ownPlayer.id)) : []
  const needsAction = ownPlayer
    ? ownMatches.filter(
        (match) => canRespond(match, ownPlayer.id) || canReviewResult(match, ownPlayer.id),
      )
    : []
  const rest = ownMatches.filter((match) => !needsAction.includes(match))
  const clubMatches = isSuperAdmin
    ? matches.filter((match) => !ownPlayer || !isParticipant(match, ownPlayer.id))
    : []
  const record = arenaRecord(matches, ownPlayer?.id ?? null)

  function renderMatch(match: FriendlyMatchRecord) {
    if (!ownPlayer) return null

    return (
      <MatchCard
        key={match.id}
        match={match}
        playerId={ownPlayer.id}
        names={names}
        now={loadedAt}
        onChanged={reload}
        onDispute={setDisputeTarget}
      />
    )
  }

  return (
    <>
      <PageHeader
        kicker="Duel board"
        title="Friendly Matches"
        description="Challenge a clubmate. The winner submits the result and the losing side has 24 hours to confirm or dispute it."
        actions={
          ownPlayer ? (
            <Button onClick={() => setChallengeOpen(true)}>
              <Plus aria-hidden="true" />
              New challenge
            </Button>
          ) : null
        }
      />

      <ArenaStatStrip
        className="mt-5"
        stats={[
          {
            label: 'Your duels',
            value: String(ownMatches.length),
            detail: 'Challenges you are part of',
          },
          {
            label: 'Record',
            value: `${record.wins}–${record.losses}`,
            detail: 'Wins and losses, decided only',
          },
          {
            label: 'Win rate',
            value: record.winRate === null ? '—' : `${Math.round(record.winRate * 100)}%`,
            detail: 'Across confirmed results',
          },
          {
            label: 'Waiting on you',
            value: String(needsAction.length),
            detail: 'Respond or confirm',
          },
        ]}
      />

      <ArenaPanel kicker="Rules" title="Confirmed friendlies award ShuttlePower" className="mt-4">
        <p className="px-4 py-3 text-sm leading-relaxed text-text-muted">
          When the losing side confirms a result (or the 24-hour auto-approval passes), both players
          receive an SP change under the club-approved formula. Doubles friendlies and dispute
          resolution are not available yet.
        </p>
      </ArenaPanel>

      {!ownPlayer ? (
        <Card className="mt-4">
          <CardContent className="p-5">
            <EmptyState
              icon={Swords}
              title="No player record linked"
              description="Ask a club admin to link your account to a player record before challenging anyone."
            />
          </CardContent>
        </Card>
      ) : ownMatches.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-5">
            <EmptyState
              icon={Swords}
              title="No friendly matches yet"
              description="Challenge an active clubmate to get started."
              action={
                <Button onClick={() => setChallengeOpen(true)}>
                  <Plus aria-hidden="true" />
                  New challenge
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {needsAction.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                Needs your action
              </h2>
              {needsAction.map(renderMatch)}
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                Your matches
              </h2>
              {rest.map(renderMatch)}
            </section>
          ) : null}
        </div>
      )}

      {clubMatches.length > 0 ? (
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
            Club matches
          </h2>
          <p className="text-xs text-text-muted">
            Super Admin view, including disputes from players outside your matches.
          </p>
          {clubMatches.map((match) => (
            <MatchSummary key={match.id} match={match} names={names} />
          ))}
        </section>
      ) : null}

      {challengeOpen && ownPlayer ? (
        <ChallengeDialog
          players={players}
          ownPlayerId={ownPlayer.id}
          matches={ownMatches}
          onOpenChange={() => setChallengeOpen(false)}
          onCreated={() => {
            setChallengeOpen(false)
            reload()
          }}
        />
      ) : null}

      {disputeTarget && ownPlayer ? (
        <DisputeDialog
          match={disputeTarget}
          names={names}
          onOpenChange={() => setDisputeTarget(null)}
          onSaved={() => {
            setDisputeTarget(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

function MatchCard({
  match,
  playerId,
  names,
  now,
  onChanged,
  onDispute,
}: {
  match: FriendlyMatchRecord
  playerId: string
  names: ReadonlyMap<string, string>
  now: number
  onChanged: () => void
  onDispute: (match: FriendlyMatchRecord) => void
}) {
  const [busy, setBusy] = React.useState(false)
  const challenger = names.get(match.challenger_id) ?? 'Unknown player'
  const opponent = names.get(match.opponent_id) ?? 'Unknown player'
  const winner = match.winner_id ? (names.get(match.winner_id) ?? 'Unknown player') : null
  const rival = names.get(opponentOf(match, playerId) ?? '') ?? 'Your opponent'
  const hours = hoursUntilAutoApproval(match, now)

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)

    try {
      await action()
      toast.success(message)
      onChanged()
    } catch (actionError) {
      toast.error(errorMessage(actionError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <ArenaAvatar name={challenger} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
            {challenger}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
            vs
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-text">
            {opponent}
          </span>
          <ArenaAvatar name={opponent} size="sm" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
          <p className="text-[11px] text-text-muted">
            {match.note ?? 'No note.'} · challenged {formatDateTime(match.created_at)}
          </p>
          <Badge tone={toneFor(match.status)}>{FRIENDLY_STATUS_LABELS[match.status]}</Badge>
        </div>
        {winner ? (
          <p className="text-sm text-text">
            Winner: {winner}
            {match.status === 'confirmed' || match.status === 'auto_approved'
              ? ` · confirmed ${formatDateTime(match.confirmed_at ?? '')}`
              : ''}
          </p>
        ) : null}

        {match.status === 'awaiting_approval' ? (
          <p className="text-xs text-text-muted">
            {match.winner_id === playerId
              ? `Waiting for ${rival} to approve.`
              : `Confirm or dispute by ${formatDateTime(match.auto_approval_due_at ?? '')}.`}
            {hours !== null ? ` ${hours} hour${hours === 1 ? '' : 's'} left.` : ''}
          </p>
        ) : null}

        {match.status === 'disputed' && match.dispute_reason ? (
          <p className="text-sm text-text-muted">Disputed: {match.dispute_reason}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canRespond(match, playerId) ? (
            <>
              <Button
                size="sm"
                loading={busy}
                onClick={() =>
                  void run(() => respondFriendlyChallenge(match.id, true), 'Challenge accepted.')
                }
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void run(() => respondFriendlyChallenge(match.id, false), 'Challenge declined.')
                }
              >
                Decline
              </Button>
            </>
          ) : null}

          {canCancel(match, playerId) ? (
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              onClick={() =>
                void run(() => cancelFriendlyChallenge(match.id), 'Challenge cancelled.')
              }
            >
              Cancel challenge
            </Button>
          ) : null}

          {canSubmitResult(match, playerId) ? (
            <Button
              size="sm"
              loading={busy}
              onClick={() =>
                void run(
                  () => submitFriendlyResult(match.id, playerId),
                  'Result submitted. Your opponent has 24 hours to confirm it.',
                )
              }
            >
              I won — submit result
            </Button>
          ) : null}

          {canReviewResult(match, playerId) ? (
            <>
              <Button
                size="sm"
                loading={busy}
                onClick={() => void run(() => approveFriendlyResult(match.id), 'Result confirmed.')}
              >
                Confirm result
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onDispute(match)}
              >
                Dispute
              </Button>
            </>
          ) : null}

          {isOpenFriendly(match.status) &&
          !canRespond(match, playerId) &&
          !canCancel(match, playerId) &&
          !canSubmitResult(match, playerId) &&
          !canReviewResult(match, playerId) ? (
            <p className="text-xs text-text-faint">No action for you right now.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function MatchSummary({
  match,
  names,
}: {
  match: FriendlyMatchRecord
  names: ReadonlyMap<string, string>
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {names.get(match.challenger_id) ?? 'Unknown'} vs{' '}
            {names.get(match.opponent_id) ?? 'Unknown'}
          </CardTitle>
          <Badge tone={toneFor(match.status)}>{FRIENDLY_STATUS_LABELS[match.status]}</Badge>
        </div>
        <CardDescription>
          {match.winner_id ? `Winner: ${names.get(match.winner_id) ?? 'Unknown'} · ` : ''}
          recorded {formatDateTime(match.created_at)}
        </CardDescription>
      </CardHeader>
      {match.status === 'disputed' && match.dispute_reason ? (
        <CardContent>
          <p className="text-sm text-text-muted">Disputed: {match.dispute_reason}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

function ChallengeDialog({
  players,
  ownPlayerId,
  matches,
  onOpenChange,
  onCreated,
}: {
  players: readonly PlayerRecord[]
  ownPlayerId: string
  matches: readonly FriendlyMatchRecord[]
  onOpenChange: () => void
  onCreated: () => void
}) {
  const [opponentId, setOpponentId] = React.useState('')
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const busyOpponents = new Set(
    matches
      .filter((match) => isOpenFriendly(match.status))
      .map((match) => opponentOf(match, ownPlayerId))
      .filter((id): id is string => id !== null),
  )
  const options = players.filter(
    (player) =>
      player.id !== ownPlayerId &&
      player.status === 'active' &&
      player.profile_id !== null &&
      !busyOpponents.has(player.id),
  )

  async function submit() {
    setError(null)

    if (!opponentId) {
      setError('Choose an opponent.')
      return
    }

    if (note.trim().length > 500) {
      setError('Keep the note to 500 characters or fewer.')
      return
    }

    setSaving(true)

    try {
      await createFriendlyChallenge(opponentId, note.trim() === '' ? null : note.trim())
      toast.success('Challenge sent.')
      onCreated()
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New friendly challenge</DialogTitle>
          <DialogDescription>
            Singles only for now. One open match per pair — doubles waits on a club rule.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-opponent">Opponent</Label>
            <Select value={opponentId} onValueChange={setOpponentId}>
              <SelectTrigger id="challenge-opponent">
                <SelectValue placeholder="Choose a player" />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No available players
                  </SelectItem>
                ) : (
                  options.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-note">Note (optional)</Label>
            <Textarea
              id="challenge-note"
              value={note}
              maxLength={500}
              placeholder="Suggested court, date, or a friendly word."
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onOpenChange} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} disabled={options.length === 0} onClick={() => void submit()}>
            Send challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DisputeDialog({
  match,
  names,
  onOpenChange,
  onSaved,
}: {
  match: FriendlyMatchRecord
  names: ReadonlyMap<string, string>
  onOpenChange: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function submit() {
    setError(null)

    if (reason.trim().length < 5) {
      setError('Explain what happened in at least 5 characters.')
      return
    }

    setSaving(true)

    try {
      await disputeFriendlyResult(match.id, reason.trim())
      toast.success('Result disputed. A club admin can review it.')
      onSaved()
    } catch (disputeError) {
      setError(errorMessage(disputeError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute this result</DialogTitle>
          <DialogDescription>
            {names.get(match.challenger_id) ?? 'Player'} vs{' '}
            {names.get(match.opponent_id) ?? 'Player'}. The submitted result will not be confirmed.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Label htmlFor="dispute-reason">Reason</Label>
          <Textarea
            id="dispute-reason"
            value={reason}
            maxLength={500}
            placeholder="What was wrong with the submitted result?"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onOpenChange} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            Submit dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
