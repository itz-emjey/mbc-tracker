import {
  canRespond,
  canReviewResult,
  canSubmitResult,
  hoursUntilAutoApproval,
  opponentOf,
} from '@/features/friendlies/matches'
import type { FriendlyMatchRecord } from '@/features/friendlies/types'
import type { JerseyOrderRecord, JerseyProjectRecord } from '@/features/jerseys/types'
import type { PlayerRecord } from '@/features/players/types'
import type { PollRecord, PollResults } from '@/features/polls/types'
import { formatMoney, paymentState, remainingAmount, sumRecorded } from '@/features/training/money'
import type {
  TrainingAttendanceRecord,
  TrainingFeePeriodRecord,
  TrainingPaymentRecord,
} from '@/features/training/types'
import type { TournamentRecord } from '@/features/tournaments/types'
import { formatDateTime } from '@/lib/format'

/**
 * Overview derivations.
 *
 * These functions are pure so the rules for "next", "open", and "needs your
 * attention" are testable and never buried in JSX. The database is still the
 * authority for access; these helpers only describe the data a member can see.
 */

export type AttentionKind = 'match' | 'fee' | 'poll' | 'jersey' | 'tournament'

export type AttentionTone = 'accent' | 'warning' | 'danger' | 'info'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  title: string
  description: string
  href: string
  tone: AttentionTone
}

interface SessionWindow {
  status: string
  starts_at: string
  ends_at: string
}

interface PollWindow {
  status: string
  opens_at: string | null
  closes_at: string | null
}

interface ProjectWindow {
  status: string
  order_deadline: string | null
}

interface TournamentWindow {
  status: string
  starts_on: string
  ends_on: string
}

interface FeeWindow {
  starts_on: string
  ends_on: string
}

function timestamp(value: string | null): number | null {
  if (!value) return null

  const parsed = Date.parse(value)

  return Number.isNaN(parsed) ? null : parsed
}

/** The next scheduled session that has not already ended. */
export function nextTrainingSession<T extends SessionWindow>(
  sessions: readonly T[],
  now: number,
): T | null {
  const upcoming = sessions
    .filter((session) => session.status === 'scheduled' && (timestamp(session.ends_at) ?? 0) >= now)
    .sort(
      (left, right) =>
        (timestamp(left.starts_at) ?? 0) - (timestamp(right.starts_at) ?? 0) ||
        left.starts_at.localeCompare(right.starts_at),
    )

  return upcoming[0] ?? null
}

/** Open polls whose start/end window includes `now`. Invalid bounds are ignored. */
export function activePolls<T extends PollWindow>(polls: readonly T[], now: number): T[] {
  return polls.filter((poll) => {
    if (poll.status !== 'open') return false

    const opens = timestamp(poll.opens_at)
    const closes = timestamp(poll.closes_at)

    return (opens === null || opens <= now) && (closes === null || closes > now)
  })
}

/** Jersey projects still accepting orders, soonest deadline first. */
export function openJerseyProjects<T extends ProjectWindow>(
  projects: readonly T[],
  now: number,
): T[] {
  return projects
    .filter((project) => {
      if (project.status !== 'open') return false

      const deadline = timestamp(project.order_deadline)

      return deadline === null || deadline > now
    })
    .sort((left, right) => {
      const leftDeadline = timestamp(left.order_deadline) ?? Number.MAX_SAFE_INTEGER
      const rightDeadline = timestamp(right.order_deadline) ?? Number.MAX_SAFE_INTEGER

      return leftDeadline - rightDeadline
    })
}

/** Published or running tournaments that have not finished yet. */
export function upcomingTournaments<T extends TournamentWindow>(
  tournaments: readonly T[],
  today: string,
): T[] {
  return tournaments
    .filter(
      (tournament) =>
        (tournament.status === 'published' || tournament.status === 'in_progress') &&
        tournament.ends_on >= today,
    )
    .sort(
      (left, right) =>
        left.starts_on.localeCompare(right.starts_on) || left.ends_on.localeCompare(right.ends_on),
    )
}

/** The most recently created fee period, which is the one the club is billing. */
export function latestFeePeriod<T extends FeeWindow>(periods: readonly T[]): T | null {
  const ordered = [...periods].sort(
    (left, right) =>
      right.starts_on.localeCompare(left.starts_on) || right.ends_on.localeCompare(left.ends_on),
  )

  return ordered[0] ?? null
}

export interface AttendanceSummary {
  attended: number
  recorded: number
}

/** Own attendance only; present and late count as attended. */
export function attendanceSummary(
  attendance: readonly TrainingAttendanceRecord[],
  playerId: string | null,
): AttendanceSummary {
  if (!playerId) return { attended: 0, recorded: 0 }

  const own = attendance.filter((row) => row.player_id === playerId)

  return {
    attended: own.filter((row) => row.status === 'present' || row.status === 'late').length,
    recorded: own.length,
  }
}

export interface FeeSummary {
  state: 'paid' | 'partial' | 'unpaid'
  paid: number
  remaining: number
}

/** Own payments against one fee period. Voided rows never count. */
export function feeSummary(
  period: TrainingFeePeriodRecord,
  payments: readonly TrainingPaymentRecord[],
  playerId: string | null,
): FeeSummary {
  const paid = playerId
    ? sumRecorded(
        payments.filter(
          (payment) => payment.player_id === playerId && payment.fee_period_id === period.id,
        ),
      )
    : 0

  return {
    state: paymentState(period.amount, paid),
    paid,
    remaining: remainingAmount(period.amount, paid),
  }
}

export interface AttentionInput {
  player: PlayerRecord | null
  now: number
  matches: readonly FriendlyMatchRecord[]
  names: ReadonlyMap<string, string>
  /** Already filtered to open, current polls. */
  polls: readonly PollRecord[]
  pollResults: ReadonlyMap<string, PollResults>
  /** Already filtered to projects still accepting orders. */
  jerseyProjects: readonly JerseyProjectRecord[]
  jerseyOrders: readonly JerseyOrderRecord[]
  feePeriod: TrainingFeePeriodRecord | null
  payments: readonly TrainingPaymentRecord[]
  tournaments: readonly TournamentRecord[]
}

function hoursLabel(hours: number | null): string {
  if (hours === null) return 'Confirm or dispute the submitted result.'

  return `${hours} hour${hours === 1 ? '' : 's'} left to confirm or dispute.`
}

function matchAttention(
  match: FriendlyMatchRecord,
  playerId: string,
  names: ReadonlyMap<string, string>,
  now: number,
): AttentionItem | null {
  const opponent = names.get(opponentOf(match, playerId) ?? '') ?? 'your opponent'

  if (canRespond(match, playerId)) {
    return {
      id: `match:${match.id}:respond`,
      kind: 'match',
      title: `Challenge from ${opponent}`,
      description: 'Accept or decline the invitation before you play.',
      href: '/matches',
      tone: 'warning',
    }
  }

  if (canReviewResult(match, playerId)) {
    return {
      id: `match:${match.id}:review`,
      kind: 'match',
      title: `Confirm your result vs ${opponent}`,
      description: hoursLabel(hoursUntilAutoApproval(match, now)),
      href: '/matches',
      tone: 'warning',
    }
  }

  if (canSubmitResult(match, playerId)) {
    return {
      id: `match:${match.id}:submit`,
      kind: 'match',
      title: `Submit your result vs ${opponent}`,
      description: 'The challenge is accepted. The winner enters the score.',
      href: '/matches',
      tone: 'info',
    }
  }

  return null
}

/**
 * Personal actions first, then club deadlines. A single account with several
 * roles still gets one queue, because these are all things *they* must do.
 */
export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []
  const { player, now } = input

  if (player) {
    for (const match of input.matches) {
      const item = matchAttention(match, player.id, input.names, now)
      if (item) items.push(item)
    }

    if (input.feePeriod) {
      const fee = feeSummary(input.feePeriod, input.payments, player.id)

      if (fee.state !== 'paid') {
        items.push({
          id: `fee:${input.feePeriod.id}`,
          kind: 'fee',
          title: `Training fee: ${input.feePeriod.label}`,
          description: `${formatMoney(fee.remaining)} remaining. Record payment with a trainer.`,
          href: '/payments',
          tone: 'danger',
        })
      }
    }
  }

  for (const tournament of input.tournaments) {
    if (tournament.status !== 'published' || !tournament.registration_deadline) continue

    const deadline = timestamp(tournament.registration_deadline)
    if (deadline === null || deadline < now) continue

    const sevenDays = 7 * 24 * 60 * 60 * 1000
    if (deadline - now > sevenDays) continue

    items.push({
      id: `tournament:${tournament.id}:deadline`,
      kind: 'tournament',
      title: `Registration closes for ${tournament.name}`,
      description: `Closes ${formatDateTime(tournament.registration_deadline)}.`,
      href: `/tournaments/${tournament.id}`,
      tone: 'info',
    })
  }

  // Voting and ordering both require an active player record server-side, so
  // never prompt an account that the database would refuse.
  if (player?.status === 'active') {
    for (const poll of input.polls) {
      const results = input.pollResults.get(poll.id)
      if (!results || results.my_option_ids.length > 0) continue

      items.push({
        id: `poll:${poll.id}`,
        kind: 'poll',
        title: `Vote: ${poll.question}`,
        description: poll.closes_at
          ? `Closes ${formatDateTime(poll.closes_at)}.`
          : 'Open for responses.',
        href: '/polls',
        tone: 'info',
      })
    }

    const orderedProjects = new Set(
      input.jerseyOrders
        .filter((order) => order.player_id === player.id && order.status === 'submitted')
        .map((order) => order.project_id),
    )

    for (const project of input.jerseyProjects) {
      if (orderedProjects.has(project.id)) continue

      items.push({
        id: `jersey:${project.id}`,
        kind: 'jersey',
        title: `Order: ${project.name}`,
        description: project.order_deadline
          ? `Order by ${formatDateTime(project.order_deadline)}.`
          : 'Ordering is open.',
        href: '/jerseys',
        tone: 'info',
      })
    }
  }

  return items
}
