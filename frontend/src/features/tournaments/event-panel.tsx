import { Check, Clock3, Swords, UserPlus } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ArenaAvatar, ProgressTrack } from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/features/auth/api'
import type { FriendEntry, PlayerRecord } from '@/features/players/types'

import {
  cancelTournamentPartnerInvitation,
  respondTournamentPartnerInvitation,
  withdrawOwnTournamentEntry,
  withdrawTournamentEntry,
} from './api'
import { entryName, seedLabel, type EntryLookups } from './display'
import { EntryFormDialog } from './entry-form-dialog'
import { EventDraw } from './event-draw'
import { JoinEventDialog } from './join-event-dialog'
import { entryPaymentProgress } from './payments'
import { PaymentsPanel } from './payments-panel'
import {
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  INVITATION_STATUS_LABELS,
  type MatchGameRecord,
  type MatchRecord,
  type PartnerInvitationRecord,
  type PaymentRecord,
  type TeamMemberRecord,
  type TournamentEntryRecord,
  type TournamentEventRecord,
  type TournamentRecord,
} from './types'

interface EventPanelProps {
  tournament: TournamentRecord
  event: TournamentEventRecord
  entries: readonly TournamentEntryRecord[]
  teamMembers: readonly TeamMemberRecord[]
  payments: readonly PaymentRecord[]
  invitations: readonly PartnerInvitationRecord[]
  matches: readonly MatchRecord[]
  games: readonly MatchGameRecord[]
  players: readonly PlayerRecord[]
  friends: readonly FriendEntry[]
  /** The signed-in member's player record, or null when none is linked. */
  currentPlayer: PlayerRecord | null
  canManage: boolean
  /** Time the page data was loaded; keeps deadline checks out of render. */
  now: number
  onChanged: () => void
}

function entryHasPlayer(
  entry: TournamentEntryRecord,
  playerId: string,
  teamMembersByTeam: ReadonlyMap<string, readonly TeamMemberRecord[]>,
): boolean {
  if (entry.player_id === playerId) return true
  if (entry.team_id === null) return false

  return (teamMembersByTeam.get(entry.team_id) ?? []).some(
    (member) => member.player_id === playerId,
  )
}

/* -------------------------------------------------------------------------- */
/* Progression                                                                */
/* -------------------------------------------------------------------------- */

type StageState = 'done' | 'current' | 'upcoming'

interface ProgressionStage {
  label: string
  meta: string
  state: StageState
}

/**
 * The event's three states of being, in the order they happen. Entries close
 * when the draw is generated; results are recorded out of that draw.
 */
function StageRail({ stages }: { stages: readonly ProgressionStage[] }) {
  return (
    <ol
      aria-label="Event progression"
      className="grid gap-2 rounded-md border border-border bg-surface-1 p-3 sm:grid-cols-3"
    >
      {stages.map((stage, index) => (
        <li key={stage.label} className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-semibold tabular-nums',
              stage.state === 'done' && 'border-accent bg-accent-soft text-accent',
              stage.state === 'current' && 'border-accent bg-surface-1 text-accent',
              stage.state === 'upcoming' && 'border-border bg-surface-1 text-text-faint',
            )}
          >
            {stage.state === 'done' ? <Check className="size-3" aria-hidden="true" /> : index + 1}
          </span>

          <span className="min-w-0">
            <span
              className={cn(
                'block text-[11px] font-semibold uppercase tracking-[0.12em]',
                stage.state === 'upcoming' ? 'text-text-faint' : 'text-text',
              )}
            >
              {stage.label}
            </span>
            <span className="block truncate font-mono text-[10px] tabular-nums text-text-faint">
              {stage.meta}
            </span>
          </span>

          {stage.state === 'current' ? (
            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.1em] text-accent">
              Now
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

interface StageProps {
  index: string
  title: string
  meta?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}

/** One numbered step of the progression. Open, never boxed. */
function Stage({ index, title, meta, description, action, children }: StageProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-2">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="font-mono text-[10px] font-semibold tabular-nums tracking-[0.08em] text-accent">
            {index}
          </span>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {title}
          </h4>
          {meta ? (
            <span className="font-mono text-[10px] tabular-nums text-text-faint">{meta}</span>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {description ? (
        <p className="text-xs leading-relaxed text-text-muted">{description}</p>
      ) : null}

      {children}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function EventPanel({
  tournament,
  event,
  entries,
  teamMembers,
  payments,
  invitations,
  matches,
  games,
  players,
  friends,
  currentPlayer,
  canManage,
  now,
  onChanged,
}: EventPanelProps) {
  const [entryOpen, setEntryOpen] = React.useState(false)
  const [joinOpen, setJoinOpen] = React.useState(false)
  const [invitationBusy, setInvitationBusy] = React.useState<string | null>(null)

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  const teamMembersByTeam = React.useMemo(() => {
    const grouped = new Map<string, TeamMemberRecord[]>()

    for (const member of teamMembers) {
      const list = grouped.get(member.team_id) ?? []
      list.push(member)
      grouped.set(member.team_id, list)
    }

    return grouped
  }, [teamMembers])

  const lookups: EntryLookups = React.useMemo(
    () => ({ playersById, teamMembersByTeam }),
    [playersById, teamMembersByTeam],
  )

  const entriesById = React.useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  )

  const eventEntries = React.useMemo(
    () => entries.filter((entry) => entry.event_id === event.id),
    [entries, event.id],
  )

  const registeredEntries = React.useMemo(
    () => eventEntries.filter((entry) => entry.status === 'registered'),
    [eventEntries],
  )

  const paymentsByEntry = React.useMemo(() => {
    const grouped = new Map<string, PaymentRecord[]>()

    for (const payment of payments) {
      const list = grouped.get(payment.entry_id) ?? []
      list.push(payment)
      grouped.set(payment.entry_id, list)
    }

    return grouped
  }, [payments])

  const eventMatches = React.useMemo(
    () => matches.filter((match) => match.event_id === event.id),
    [matches, event.id],
  )

  /** Set scores for this event only; the draw board needs them grouped. */
  const eventGames = React.useMemo(() => {
    const matchIds = new Set(eventMatches.map((match) => match.id))
    return games.filter((game) => matchIds.has(game.match_id))
  }, [games, eventMatches])

  const eventInvitations = React.useMemo(
    () => invitations.filter((invitation) => invitation.event_id === event.id),
    [invitations, event.id],
  )

  const eventPayments = React.useMemo(
    () => payments.filter((payment) => eventEntries.some((entry) => entry.id === payment.entry_id)),
    [payments, eventEntries],
  )
  const settledFees = eventPayments.filter((payment) => payment.status !== 'unpaid').length

  const deadlinePassed =
    tournament.status === 'published' &&
    tournament.registration_deadline !== null &&
    new Date(tournament.registration_deadline).getTime() < now

  const drawExists = event.draw_generated_at !== null
  const staffRegistrationOpen =
    (tournament.status === 'draft' || tournament.status === 'published') && !deadlinePassed
  const canStaffRegister = staffRegistrationOpen && !drawExists
  const playerRegistrationOpen = tournament.status === 'published' && !deadlinePassed && !drawExists

  const myEntry = React.useMemo(() => {
    if (!currentPlayer) return null

    return (
      registeredEntries.find((entry) =>
        entryHasPlayer(entry, currentPlayer.id, teamMembersByTeam),
      ) ?? null
    )
  }, [currentPlayer, registeredEntries, teamMembersByTeam])

  const incomingInvitation = React.useMemo(() => {
    if (!currentPlayer) return null

    return (
      eventInvitations.find(
        (invitation) =>
          invitation.status === 'pending' && invitation.partner_player_id === currentPlayer.id,
      ) ?? null
    )
  }, [currentPlayer, eventInvitations])

  const outgoingInvitation = React.useMemo(() => {
    if (!currentPlayer) return null

    return (
      eventInvitations.find(
        (invitation) =>
          invitation.status === 'pending' && invitation.inviter_player_id === currentPlayer.id,
      ) ?? null
    )
  }, [currentPlayer, eventInvitations])

  const eventFull = registeredEntries.length >= event.max_entries
  const canSelfJoin =
    playerRegistrationOpen &&
    currentPlayer !== null &&
    currentPlayer.status === 'active' &&
    myEntry === null &&
    incomingInvitation === null &&
    outgoingInvitation === null &&
    !eventFull

  const completedMatches = eventMatches.filter((match) => match.status === 'completed').length
  const allPlayed = eventMatches.length > 0 && completedMatches === eventMatches.length

  const stages: ProgressionStage[] = [
    {
      label: 'Entries',
      meta: `${registeredEntries.length} / ${event.max_entries}`,
      state: drawExists ? 'done' : 'current',
    },
    {
      label: 'Draw',
      meta: drawExists
        ? `${eventMatches.length} match${eventMatches.length === 1 ? '' : 'es'}`
        : 'not generated',
      state: drawExists ? 'done' : 'upcoming',
    },
    {
      label: 'Results',
      meta:
        eventMatches.length === 0
          ? 'no matches yet'
          : `${completedMatches} / ${eventMatches.length} played`,
      state: allPlayed ? 'done' : drawExists ? 'current' : 'upcoming',
    },
  ]

  async function handleStaffWithdraw(entry: TournamentEntryRecord) {
    await withdrawTournamentEntry(entry.id)
    toast.success('Entry withdrawn. The record and its history are kept.')
    onChanged()
  }

  async function handleOwnWithdraw(entry: TournamentEntryRecord) {
    await withdrawOwnTournamentEntry(entry.id)
    toast.success('You have withdrawn from this event.')
    onChanged()
  }

  async function handleInvitation(invitation: PartnerInvitationRecord, accept: boolean) {
    setInvitationBusy(invitation.id)

    try {
      await respondTournamentPartnerInvitation(invitation.id, accept)
      toast.success(
        accept ? 'Invitation accepted. Your doubles team is registered.' : 'Invitation declined.',
      )
      onChanged()
    } catch (invitationError) {
      toast.error(errorMessage(invitationError))
    } finally {
      setInvitationBusy(null)
    }
  }

  async function handleCancelInvitation(invitation: PartnerInvitationRecord) {
    setInvitationBusy(invitation.id)

    try {
      await cancelTournamentPartnerInvitation(invitation.id)
      toast.success('Invitation cancelled.')
      onChanged()
    } catch (invitationError) {
      toast.error(errorMessage(invitationError))
    } finally {
      setInvitationBusy(null)
    }
  }

  const inviterName = incomingInvitation
    ? (playersById.get(incomingInvitation.inviter_player_id)?.full_name ?? 'A player')
    : ''
  const partnerName = outgoingInvitation
    ? (playersById.get(outgoingInvitation.partner_player_id)?.full_name ?? 'your partner')
    : ''

  return (
    <section className="flex flex-col gap-5" aria-labelledby={`event-${event.id}`}>
      <header className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`event-${event.id}`}
              className="text-xl font-semibold tracking-tight text-text sm:text-2xl"
            >
              {DISCIPLINE_LABELS[event.discipline]}
            </h3>
            <Badge tone="outline">{FORMAT_LABELS[event.format]}</Badge>
            <Badge tone={drawExists ? 'accent' : 'neutral'}>
              {drawExists ? 'Draw locked' : 'Entries open'}
            </Badge>
            <Badge tone="neutral">Cap {event.max_entries}</Badge>
          </div>

          <p className="mt-1.5 font-mono text-[11px] tabular-nums text-text-muted">
            {registeredEntries.length} registered · {eventMatches.length} matches ·{' '}
            {completedMatches} results
          </p>

          {myEntry ? (
            <p className="mt-1 text-xs font-medium text-accent">
              You are registered for this event.
            </p>
          ) : incomingInvitation ? (
            <p className="mt-1 text-xs font-medium text-warning">
              A partner has invited you. Answer below to complete the entry.
            </p>
          ) : outgoingInvitation ? (
            <p className="mt-1 text-xs font-medium text-warning">
              Waiting for {partnerName} to accept your invitation.
            </p>
          ) : playerRegistrationOpen && currentPlayer === null ? (
            <p className="mt-1 text-xs text-text-muted">
              Ask staff to link your account to a player record before joining.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          {canManage && canStaffRegister ? (
            <Button size="sm" onClick={() => setEntryOpen(true)}>
              <UserPlus aria-hidden="true" />
              Add entry
            </Button>
          ) : null}

          {canSelfJoin ? (
            <Button size="sm" onClick={() => setJoinOpen(true)}>
              <UserPlus aria-hidden="true" />
              Join event
            </Button>
          ) : null}
        </div>
      </header>

      <StageRail stages={stages} />

      {incomingInvitation ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-warning">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Partner invitation
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {inviterName} invited you to partner in {DISCIPLINE_LABELS[event.discipline]}.
              Accepting registers the team; both players then owe the entrance fee.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void handleInvitation(incomingInvitation, true)}
              loading={invitationBusy === incomingInvitation.id}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleInvitation(incomingInvitation, false)}
              disabled={invitationBusy === incomingInvitation.id}
            >
              Decline
            </Button>
            <span className="text-[11px] text-text-faint">
              {INVITATION_STATUS_LABELS[incomingInvitation.status]}
            </span>
          </div>
        </div>
      ) : null}

      {outgoingInvitation ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-warning">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Invitation sent
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {partnerName} must accept before your doubles entry is created.
            </p>
          </div>

          <ConfirmDialog
            trigger={
              <Button
                size="sm"
                variant="secondary"
                disabled={invitationBusy === outgoingInvitation.id}
              >
                Cancel invitation
              </Button>
            }
            title={`Cancel the invitation to ${partnerName}?`}
            description="No entry exists yet, so cancelling only withdraws the offer. You can invite someone else afterwards."
            confirmLabel="Cancel invitation"
            tone="primary"
            onConfirm={() => handleCancelInvitation(outgoingInvitation)}
          />
        </div>
      ) : null}

      <Stage
        index="01"
        title="Entries"
        meta={`${registeredEntries.length} of ${event.max_entries} places`}
        description={
          drawExists
            ? 'The draw is generated, so entries can no longer be added or withdrawn.'
            : canManage
              ? 'Add players or teams. Withdrawing keeps the record and frees the place and seed before the draw.'
              : 'Each player or doubles team appears here. Unpaid entries stay registered but are excluded from the draw.'
        }
      >
        {registeredEntries.length > 0 ? (
          <ProgressTrack
            value={registeredEntries.length / Math.max(1, event.max_entries)}
            label="Places filled"
          />
        ) : null}

        {eventEntries.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No entries yet"
            description={
              canManage
                ? 'Register players or doubles teams for this event.'
                : 'No one has joined this event yet.'
            }
            action={
              canManage && canStaffRegister ? (
                <Button size="sm" onClick={() => setEntryOpen(true)}>
                  <UserPlus aria-hidden="true" />
                  Add entry
                </Button>
              ) : canSelfJoin ? (
                <Button size="sm" onClick={() => setJoinOpen(true)}>
                  <UserPlus aria-hidden="true" />
                  Join event
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {eventEntries.map((entry) => {
              const entryPayments = paymentsByEntry.get(entry.id) ?? []
              const progress = entryPaymentProgress(entryPayments)
              const name = entryName(entry, lookups)
              const isMine =
                currentPlayer !== null && entryHasPlayer(entry, currentPlayer.id, teamMembersByTeam)
              const canWithdrawAsStaff = canManage && staffRegistrationOpen && !drawExists
              const canWithdrawAsPlayer =
                !canManage && isMine && playerRegistrationOpen && entry.status === 'registered'

              return (
                <li key={entry.id} className="flex items-center gap-2.5 py-2">
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-sm border border-border bg-surface-2 font-mono text-[10px] text-text-muted"
                  >
                    {entry.seed === null ? '—' : `#${entry.seed}`}
                  </span>

                  <ArenaAvatar name={name} size="sm" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text">{name}</span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-[10px]',
                        progress.total > 0 && !progress.eligible
                          ? 'text-danger'
                          : 'text-text-faint',
                      )}
                    >
                      {seedLabel(entry.seed)}
                      {progress.total === 0 ? '' : ` · ${progress.settled}/${progress.total} fees`}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={entry.status} />

                    {entry.status === 'registered' &&
                    (canWithdrawAsStaff || canWithdrawAsPlayer) ? (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                            Withdraw
                          </Button>
                        }
                        title={`Withdraw ${name}?`}
                        description={
                          canWithdrawAsPlayer
                            ? 'You leave this event. For doubles, the whole team withdraws. The entry stays in history and no longer counts toward the cap.'
                            : 'The entry stays in history, but it no longer counts toward the cap and its seed becomes available. Withdrawals are only possible before the draw.'
                        }
                        confirmLabel="Withdraw entry"
                        onConfirm={() =>
                          canWithdrawAsPlayer
                            ? handleOwnWithdraw(entry)
                            : handleStaffWithdraw(entry)
                        }
                      />
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {deadlinePassed && !drawExists ? (
          <p className="text-xs text-text-muted">
            The registration deadline has passed. The draw can still be generated.
          </p>
        ) : null}

        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] font-medium text-text-muted transition-colors duration-fast hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring [&::-webkit-details-marker]:hidden">
            <span>
              Fee ledger · {settledFees}/{eventPayments.length} settled
            </span>
            <span className="text-text-faint">{canManage ? 'Mark payments' : 'View payments'}</span>
          </summary>

          <div className="mt-3">
            <PaymentsPanel
              entries={eventEntries}
              teamMembers={teamMembers}
              players={players}
              payments={eventPayments}
              canManage={canManage}
              onChanged={onChanged}
            />
          </div>
        </details>
      </Stage>

      <Stage
        index="02"
        title="Draw and results"
        meta={
          eventMatches.length === 0
            ? 'no matches yet'
            : `${completedMatches} / ${eventMatches.length} played`
        }
        description={
          drawExists
            ? 'Byes advance automatically. Recording a result moves the winner on, or updates the standings.'
            : canManage
              ? 'Generate the draw once the entries are final. This locks the entry list and starts the bracket.'
              : 'Tournament staff generate the draw once entries close.'
        }
        action={
          drawExists ? (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/tournaments/${tournament.id}/draws?event=${event.id}`}>
                <Swords aria-hidden="true" />
                Focus view
              </Link>
            </Button>
          ) : null
        }
      >
        <EventDraw
          tournament={tournament}
          event={event}
          entries={eventEntries}
          matches={eventMatches}
          games={eventGames}
          entriesById={entriesById}
          lookups={lookups}
          canManage={canManage}
          canRecord={tournament.status === 'in_progress'}
          headerless
          onChanged={onChanged}
        />
      </Stage>

      {entryOpen ? (
        <EntryFormDialog
          key={event.id}
          open={entryOpen}
          event={event}
          players={players}
          entries={entries}
          teamMembers={teamMembers}
          onOpenChange={setEntryOpen}
          onCreated={() => {
            setEntryOpen(false)
            onChanged()
          }}
        />
      ) : null}

      {joinOpen && currentPlayer ? (
        <JoinEventDialog
          key={`${event.id}-${currentPlayer.id}`}
          open
          event={event}
          tournament={tournament}
          currentPlayer={currentPlayer}
          friends={friends}
          onOpenChange={setJoinOpen}
          onJoined={onChanged}
        />
      ) : null}
    </section>
  )
}
