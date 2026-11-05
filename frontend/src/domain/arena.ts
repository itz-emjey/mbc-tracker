/**
 * Arena presentation rules.
 *
 * These divisions are a *display* device for the home hub, not a club ranking
 * rule: the match-SP formula is approved (`PLAN.md` §7.1), but the bands below
 * are display-only and do not change an award. Keeping them in one module means
 * a single function owns the thresholds if the club later approves real tiers.
 *
 * Pure by design — no React, no Supabase, and no clock reads. Callers pass
 * `now` and calendar dates in.
 */

export type ArenaTierId = 'feather' | 'rally' | 'smash' | 'apex' | 'legend'

export type ArenaTierTone = 'neutral' | 'info' | 'accent' | 'warning' | 'bright'

export interface ArenaTier {
  id: ArenaTierId
  label: string
  /** Player-facing rank name for this division. Display-only, like the band. */
  rankTitle: string
  /** Lowest SP that belongs to this division. */
  minSp: number
  tone: ArenaTierTone
  blurb: string
}

/**
 * Ordered low → high. The first entry must start at 0 so every balance has a
 * home, including zero after a season deduction.
 */
export const ARENA_TIERS = [
  {
    id: 'feather',
    label: 'Feather',
    rankTitle: 'Rookie',
    minSp: 0,
    tone: 'neutral',
    blurb: 'Learning the court.',
  },
  {
    id: 'rally',
    label: 'Rally',
    rankTitle: 'Challenger',
    minSp: 1000,
    tone: 'info',
    blurb: 'Holding the pace.',
  },
  {
    id: 'smash',
    label: 'Smash',
    rankTitle: 'Striker',
    minSp: 1150,
    tone: 'accent',
    blurb: 'Winning the long exchanges.',
  },
  {
    id: 'apex',
    label: 'Apex',
    rankTitle: 'Elite',
    minSp: 1300,
    tone: 'warning',
    blurb: 'Favourite in most draws.',
  },
  {
    id: 'legend',
    label: 'Legend',
    rankTitle: 'Champion',
    minSp: 1450,
    tone: 'bright',
    blurb: 'Sets the club standard.',
  },
] as const satisfies readonly ArenaTier[]

/** Shown wherever a division badge appears, so the UI never overstates it. */
export const ARENA_DIVISION_NOTICE =
  'Divisions and rank titles are display labels for SP; they do not change the approved formula.'

export interface TierProgress {
  tier: ArenaTier
  /** `null` in the open-ended top division. */
  next: ArenaTier | null
  /** 0–1 progress across the current band; 1 in the top division. */
  progress: number
  /** SP still needed to reach the next division, `null` at the top. */
  spToNext: number | null
  /** SP earned above the current division floor. */
  spIntoTier: number
  /** Width of the current band in SP, `null` at the top. */
  tierSpan: number | null
}

/** Resolves the division and in-division progress for a balance. */
export function tierFor(sp: number): TierProgress {
  const value = Number.isFinite(sp) ? Math.max(0, sp) : 0

  let index = 0

  for (let position = 0; position < ARENA_TIERS.length; position += 1) {
    const candidate = ARENA_TIERS[position]

    if (candidate && value >= candidate.minSp) index = position
  }

  const tier = ARENA_TIERS[index] ?? ARENA_TIERS[0]
  const next = ARENA_TIERS[index + 1] ?? null
  const spIntoTier = Math.max(0, value - tier.minSp)
  const tierSpan = next ? next.minSp - tier.minSp : null
  const progress =
    tierSpan === null || tierSpan <= 0 ? 1 : Math.min(1, Math.max(0, spIntoTier / tierSpan))

  return {
    tier,
    next,
    progress,
    spToNext: next ? Math.max(0, next.minSp - value) : null,
    spIntoTier,
    tierSpan,
  }
}

/** The shape the arena needs from a friendly match record. */
export interface ArenaMatchLike {
  id: string
  match_type?: string
  challenger_id: string
  challenger_partner_id?: string | null
  opponent_id: string
  opponent_partner_id?: string | null
  status: string
  winner_id: string | null
  challenger_approved_at?: string | null
  challenger_partner_approved_at?: string | null
  opponent_approved_at?: string | null
  opponent_partner_approved_at?: string | null
  created_at: string
  confirmed_at?: string | null
  auto_approval_due_at?: string | null
}

type ArenaTeam = 'challenger' | 'opponent'

/** The team a player belongs to, captains and doubles partners alike. */
function playerTeam(match: ArenaMatchLike, playerId: string): ArenaTeam | null {
  if (match.challenger_id === playerId || match.challenger_partner_id === playerId) {
    return 'challenger'
  }

  if (match.opponent_id === playerId || match.opponent_partner_id === playerId) {
    return 'opponent'
  }

  return null
}

/** `winner_id` stores the winning captain, so compare teams, not ids. */
function winningTeam(match: ArenaMatchLike): ArenaTeam | null {
  if (match.winner_id === null) return null

  return playerTeam(match, match.winner_id)
}

function playerWon(match: ArenaMatchLike, playerId: string): boolean {
  const winner = winningTeam(match)

  return winner !== null && winner === playerTeam(match, playerId)
}

/** Whether this player already approved a submitted result. */
function playerApproved(match: ArenaMatchLike, playerId: string): boolean {
  if (match.challenger_id === playerId) return match.challenger_approved_at != null
  if (match.challenger_partner_id === playerId) {
    return match.challenger_partner_approved_at != null
  }
  if (match.opponent_id === playerId) return match.opponent_approved_at != null
  if (match.opponent_partner_id === playerId) return match.opponent_partner_approved_at != null

  return false
}

/** Statuses where the result is settled and countable. */
const FINAL_STATUSES: readonly string[] = ['confirmed', 'auto_approved']

export type ArenaResult = 'win' | 'loss'

export interface ArenaRecord {
  played: number
  wins: number
  losses: number
  /** Wins per decided match; `null` before the first result. */
  winRate: number | null
  /** Recent decided results, newest first, at most five. */
  form: readonly ArenaResult[]
  streak: { kind: ArenaResult; length: number } | null
}

function settledTime(match: ArenaMatchLike): string {
  return match.confirmed_at ?? match.created_at
}

/** Wins, losses, win rate, recent form, and the current streak. */
export function arenaRecord(
  matches: readonly ArenaMatchLike[],
  playerId: string | null,
): ArenaRecord {
  if (!playerId) {
    return { played: 0, wins: 0, losses: 0, winRate: null, form: [], streak: null }
  }

  const results = matches
    .filter(
      (match) =>
        FINAL_STATUSES.includes(match.status) &&
        match.winner_id !== null &&
        playerTeam(match, playerId) !== null,
    )
    .sort((left, right) => settledTime(right).localeCompare(settledTime(left)))
    .map((match): ArenaResult => (playerWon(match, playerId) ? 'win' : 'loss'))

  const wins = results.filter((result) => result === 'win').length
  const played = results.length
  const first = results[0]

  let streakLength = 0

  if (first) {
    for (const result of results) {
      if (result !== first) break
      streakLength += 1
    }
  }

  return {
    played,
    wins,
    losses: played - wins,
    winRate: played === 0 ? null : wins / played,
    form: results.slice(0, 5),
    streak: first ? { kind: first, length: streakLength } : null,
  }
}

export interface ArenaMatchRow {
  id: string
  opponentId: string
  /** `incoming` when the other player sent the challenge. */
  direction: 'incoming' | 'outgoing'
  status: string
  result: ArenaResult | null
  /** The next step is on this player: respond, submit, or review. */
  needsYou: boolean
  /** Hours left in the 24-hour review window, `null` outside it. */
  hoursLeft: number | null
  createdAt: string
}

function hoursUntil(dueAt: string | null | undefined, now: number): number | null {
  if (!dueAt) return null

  const due = Date.parse(dueAt)

  if (Number.isNaN(due)) return null

  return Math.max(0, Math.ceil((due - now) / 3_600_000))
}

function needsPlayer(match: ArenaMatchLike, playerId: string): boolean {
  const team = playerTeam(match, playerId)

  if (team === null) return false
  if (match.status === 'pending') return match.opponent_id === playerId
  if (match.status === 'accepted') return true
  if (match.status === 'awaiting_approval') {
    return !playerWon(match, playerId) && !playerApproved(match, playerId)
  }

  return false
}

function rowWeight(row: ArenaMatchRow): number {
  if (row.needsYou) return 0

  switch (row.status) {
    case 'awaiting_approval':
      return 1
    case 'accepted':
      return 2
    case 'pending':
      return 3
    case 'disputed':
      return 4
    default:
      return 5
  }
}

/**
 * The player's matches as arena rows: actions on them first, then open
 * matches, then settled results. Intentionally quiet about permissions — the
 * database still decides what may be done.
 */
export function arenaMatches(
  matches: readonly ArenaMatchLike[],
  playerId: string | null,
  now: number,
  limit = 6,
): ArenaMatchRow[] {
  if (!playerId) return []

  const rows = matches.flatMap((match): ArenaMatchRow[] => {
    const team = playerTeam(match, playerId)

    if (team === null) return []

    const incoming = team === 'opponent'
    const settled = FINAL_STATUSES.includes(match.status)

    return [
      {
        id: match.id,
        opponentId: incoming ? match.challenger_id : match.opponent_id,
        direction: incoming ? 'incoming' : 'outgoing',
        status: match.status,
        result: settled
          ? match.winner_id === null
            ? null
            : playerWon(match, playerId)
              ? 'win'
              : 'loss'
          : null,
        needsYou: needsPlayer(match, playerId),
        hoursLeft:
          match.status === 'awaiting_approval' ? hoursUntil(match.auto_approval_due_at, now) : null,
        createdAt: match.created_at,
      },
    ]
  })

  return rows
    .sort(
      (left, right) =>
        rowWeight(left) - rowWeight(right) ||
        right.createdAt.localeCompare(left.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit)
}

/** A ranked row, as the ladder displays it. */
export interface LadderRowLike {
  playerId: string
  fullName: string
  sp: number
  position: number
}

export interface RivalRow {
  playerId: string
  fullName: string
  sp: number
  position: number
  /** Positive when this player sits above the signed-in player. */
  delta: number
}

/** The nearest balances by SP, so the ladder has a next step. */
export function rivalsNear(
  rows: readonly LadderRowLike[],
  playerId: string | null,
  limit = 4,
): RivalRow[] {
  if (!playerId) return []

  const own = rows.find((row) => row.playerId === playerId)

  if (!own) return []

  return rows
    .filter((row) => row.playerId !== playerId)
    .map((row) => ({
      playerId: row.playerId,
      fullName: row.fullName,
      sp: row.sp,
      position: row.position,
      delta: row.sp - own.sp,
    }))
    .sort(
      (left, right) =>
        Math.abs(left.delta) - Math.abs(right.delta) || left.position - right.position,
    )
    .slice(0, limit)
}

/** Whole calendar days between two `YYYY-MM-DD` values; `null` if invalid. */
export function daysBetween(from: string, to: string): number | null {
  const start = dayNumber(from)
  const end = dayNumber(to)

  if (start === null || end === null) return null

  return Math.round((end - start) / 86_400_000)
}

function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  return Date.UTC(year, month - 1, day)
}
