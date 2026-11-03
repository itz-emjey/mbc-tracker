import { Clock3, Swords, UserPlus } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ArenaAvatar, ArenaPanel } from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { JoinEventDialog } from './join-event-dialog'
import { entryPaymentProgress } from './payments'
import { PaymentsPanel } from './payments-panel'
import {
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  INVITATION_STATUS_LABELS,
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

export function EventPanel({
  tournament,
  event,
  entries,
  teamMembers,
  payments,
  invitations,
  matches,
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

  const eventInvitations = React.useMemo(
    () => invitations.filter((invitation) => invitation.event_id === event.id),
    [invitations, event.id],
  )

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
    <section className="flex flex-col gap-3" aria-labelledby={`event-${event.id}`}>
      <div className="overflow-hidden rounded-md border border-border bg-surface-1">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">Event</p>
            <h2
              id={`event-${event.id}`}
              className="mt-0.5 text-lg font-semibold tracking-tight text-text"
            >
              {DISCIPLINE_LABELS[event.discipline]}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">{FORMAT_LABELS[event.format]}</Badge>
              <Badge tone="neutral">Cap {event.max_entries}</Badge>
              <Badge tone={drawExists ? 'accent' : 'neutral'}>
                {drawExists ? 'Draw locked' : 'Entries open'}
              </Badge>
            </div>
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
        </div>

        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
          <div className="bg-surface-1 px-4 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Registered</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-text">
              {registeredEntries.length}
              <span className="text-text-faint"> / {event.max_entries}</span>
            </dd>
          </div>
          <div className="bg-surface-1 px-4 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Entry list</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-text">
              {eventEntries.length}
            </dd>
          </div>
          <div className="bg-surface-1 px-4 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Draw</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-text">
              {completedMatches}
              <span className="text-text-faint"> / {eventMatches.length} played</span>
            </dd>
          </div>
        </dl>
      </div>

      {incomingInvitation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="size-4 text-warning" aria-hidden="true" />
              Partner invitation
            </CardTitle>
            <CardDescription>
              {inviterName} invited you to partner in {DISCIPLINE_LABELS[event.discipline]}.
              Accepting registers the team; both players then owe the entrance fee.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void handleInvitation(incomingInvitation, true)}
              loading={invitationBusy === incomingInvitation.id}
            >
              Accept invitation
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleInvitation(incomingInvitation, false)}
              disabled={invitationBusy === incomingInvitation.id}
            >
              Decline
            </Button>
            <span className="self-center text-xs text-text-faint">
              {INVITATION_STATUS_LABELS[incomingInvitation.status]}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {outgoingInvitation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="size-4 text-warning" aria-hidden="true" />
              Invitation sent
            </CardTitle>
            <CardDescription>
              {partnerName} must accept before your doubles entry is created.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      <ArenaPanel
        kicker="Entry list"
        title="Entrants"
        description={
          drawExists
            ? 'The draw is generated, so entries can no longer be added or withdrawn.'
            : canManage
              ? 'Add players or teams. Withdrawing keeps the record and frees the cap and seed before the draw.'
              : 'Each player or doubles team appears here. Unpaid entries stay registered but are excluded from the draw.'
        }
      >
        <div className="p-3">
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
            <ul className="grid gap-2 sm:grid-cols-2">
              {eventEntries.map((entry) => {
                const entryPayments = paymentsByEntry.get(entry.id) ?? []
                const progress = entryPaymentProgress(entryPayments)
                const name = entryName(entry, lookups)
                const isMine =
                  currentPlayer !== null &&
                  entryHasPlayer(entry, currentPlayer.id, teamMembersByTeam)
                const canWithdrawAsStaff = canManage && staffRegistrationOpen && !drawExists
                const canWithdrawAsPlayer =
                  !canManage && isMine && playerRegistrationOpen && entry.status === 'registered'

                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2 p-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-surface-1 font-mono text-[11px] text-text-muted"
                    >
                      {entry.seed === null ? '—' : `#${entry.seed}`}
                    </span>

                    <ArenaAvatar name={name} size="sm" />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-text">
                        {name}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block truncate text-[10px]',
                          progress.total > 0 && !progress.eligible
                            ? 'text-danger'
                            : 'text-text-faint',
                        )}
                      >
                        {seedLabel(entry.seed)}
                        {progress.total === 0
                          ? ''
                          : ` · ${progress.settled}/${progress.total} fees`}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-col items-end gap-1">
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
            <p className="mt-3 text-xs text-text-muted">
              The registration deadline has passed. The draw can still be generated.
            </p>
          ) : null}
        </div>
      </ArenaPanel>

      <PaymentsPanel
        entries={eventEntries}
        teamMembers={teamMembers}
        players={players}
        payments={payments.filter((payment) =>
          eventEntries.some((entry) => entry.id === payment.entry_id),
        )}
        canManage={canManage}
        onChanged={onChanged}
      />

      <ArenaPanel
        kicker="Draw room"
        title={drawExists ? 'Draw and results' : 'Draw'}
        description={
          drawExists
            ? 'The bracket, standings, and result entry live in the draw room.'
            : 'The draw is generated in the draw room once the entries are final.'
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-text-muted">
            {completedMatches} of {eventMatches.length} matches played. Open the draw room to follow
            this event's bracket.
          </p>

          <Button asChild variant="secondary" size="sm">
            <Link to={`/tournaments/${tournament.id}/draws?event=${event.id}`}>
              <Swords aria-hidden="true" />
              Open draw room
            </Link>
          </Button>
        </div>
      </ArenaPanel>

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
