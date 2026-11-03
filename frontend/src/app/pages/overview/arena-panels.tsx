import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  MapPin,
  Megaphone,
  Shirt,
  Swords,
  Target,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ArenaAvatar, ArenaPanel, PowerMeter, RankBadge } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  type AccountStatus,
  type Role,
} from '@/features/auth/types'
import { PLAYER_STATUS_LABELS, type PlayerRecord } from '@/features/players/types'
import type { LeaderboardRow } from '@/features/shuttlepower/leaderboard'
import { formatMoney } from '@/features/training/money'
import type { TrainingSessionRecord } from '@/features/training/types'
import type { TournamentRecord } from '@/features/tournaments/types'
import {
  ARENA_DIVISION_NOTICE,
  daysBetween,
  tierFor,
  type ArenaMatchRow,
  type ArenaRecord,
  type ArenaTierTone,
  type RivalRow,
  type TierProgress,
} from '@/domain/arena'
import { cn } from '@/lib/cn'
import { formatDateRange, formatDateTime } from '@/lib/format'

import type { AttentionItem, FeeSummary } from './derive'

const ROW_LINK =
  'group flex items-center gap-3 px-4 py-2.5 transition-colors duration-fast hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-inset'

const ARROW =
  'size-3.5 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5'

const TIER_TEXT_CLASSES: Record<ArenaTierTone, string> = {
  neutral: 'text-text-faint',
  info: 'text-info',
  accent: 'text-accent',
  warning: 'text-warning',
  bright: 'text-text',
}

/* -------------------------------------------------------------------------- */
/* Your fighter                                                               */
/* -------------------------------------------------------------------------- */

export interface FighterCardProps {
  player: PlayerRecord | null
  sp: number | null
  position: number | null
  totalPlayers: number
  divisionPosition: number | null
  record: ArenaRecord
  progress: TierProgress | null
  roles: readonly Role[]
  status: AccountStatus
  className?: string
}

export function FighterCard({
  player,
  sp,
  position,
  totalPlayers,
  divisionPosition,
  record,
  progress,
  roles,
  status,
  className,
}: FighterCardProps) {
  return (
    <ArenaPanel
      kicker="Clash card"
      title="Your fighter"
      action={{ href: '/shuttlepower', label: 'Ladder' }}
      className={cn('border-t-2 border-t-accent', className)}
    >
      {!player ? (
        <div className="p-4">
          <EmptyState
            icon={Zap}
            title="No player record linked"
            description="An admin links your account to a player record. Your clash card appears after that."
          />
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <ArenaAvatar
              name={player.full_name}
              size="xl"
              tone={progress?.tier.tone ?? 'neutral'}
              ring
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold leading-tight text-text">
                {player.full_name}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-text-faint">{player.player_code}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {progress ? <RankBadge tier={progress.tier} /> : null}
                {progress && divisionPosition !== null ? (
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-faint">
                    #{divisionPosition} in rank
                  </span>
                ) : null}
                <Badge tone="outline">{PLAYER_STATUS_LABELS[player.status]}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">
                ShuttlePower
              </p>
              <p className="mt-1 font-mono text-4xl font-semibold leading-none tabular-nums text-text">
                {sp === null ? '—' : sp.toLocaleString()}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">Club rank</p>
              <p className="mt-1 font-mono text-2xl font-semibold leading-none tabular-nums text-text">
                {position === null ? '—' : `#${position}`}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">of {totalPlayers}</p>
            </div>
          </div>

          {progress ? (
            <div className="mt-4">
              <PowerMeter
                progress={progress.progress}
                label={`${progress.tier.rankTitle} rank progress`}
              />
              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-text-muted">
                  {progress.next
                    ? `${progress.spIntoTier} / ${progress.tierSpan} SP in ${progress.tier.rankTitle}`
                    : `${progress.tier.rankTitle} — the top rank`}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-text-faint">
                  {progress.next ? `${progress.spToNext} to ${progress.next.rankTitle}` : 'Max'}
                </span>
              </div>
            </div>
          ) : null}

          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
            <Stat label="Played" value={String(record.played)} />
            <Stat label="Wins" value={String(record.wins)} />
            <Stat
              label="Win rate"
              value={record.winRate === null ? '—' : `${Math.round(record.winRate * 100)}%`}
            />
          </dl>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {record.form.length === 0 ? (
                <span className="text-[11px] text-text-faint">No decided matches yet</span>
              ) : (
                record.form.map((result, index) => (
                  <span
                    key={`${result}-${index}`}
                    title={result === 'win' ? 'Win' : 'Loss'}
                    className={cn(
                      'grid size-5 place-items-center rounded-sm text-[10px] font-semibold',
                      result === 'win'
                        ? 'bg-accent-soft text-accent'
                        : 'bg-danger-soft text-danger',
                    )}
                  >
                    {result === 'win' ? 'W' : 'L'}
                  </span>
                ))
              )}
            </div>

            {record.streak ? (
              <Badge tone={record.streak.kind === 'win' ? 'accent' : 'danger'}>
                <Flame className="size-3" aria-hidden="true" />
                {record.streak.length} {record.streak.kind === 'win' ? 'win' : 'loss'} run
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild size="sm">
              <Link to="/matches">
                <Swords aria-hidden="true" />
                Challenge
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/shuttlepower">
                <Zap aria-hidden="true" />
                Ladder
              </Link>
            </Button>
          </div>

          {sp === null ? (
            <p className="mt-3 text-[11px] leading-snug text-text-muted">
              No SP account yet. Starting SP is awarded when an approved account is linked to a
              player record.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
            <Badge
              tone={status === 'approved' ? 'accent' : status === 'pending' ? 'warning' : 'danger'}
            >
              {ACCOUNT_STATUS_LABELS[status]}
            </Badge>
            {roles.map((role) => (
              <Badge key={role} tone="outline">
                {ROLE_LABELS[role]}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </ArenaPanel>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-text">{value}</dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick actions                                                              */
/* -------------------------------------------------------------------------- */

const QUICK_ACTIONS = [
  { href: '/matches', label: 'Find a match', hint: 'Challenge a player', icon: Swords },
  { href: '/shuttlepower', label: 'Ladder', hint: 'Ranks and SP', icon: Zap },
  { href: '/tournaments', label: 'Events', hint: 'Join a bracket', icon: Trophy },
  { href: '/training', label: 'Training', hint: 'Next session', icon: CalendarCheck },
] as const

export function QuickActions({ className }: { className?: string }) {
  return (
    <ArenaPanel kicker="Arena floor" title="Jump in" className={className}>
      <div className="grid grid-cols-2 gap-2 p-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon

          return (
            <Link
              key={action.href}
              to={action.href}
              className="group flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3 transition-colors duration-fast hover:border-accent-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              <span className="grid size-8 place-items-center rounded-sm bg-accent-soft text-accent">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-text">
                  {action.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">
                  {action.hint}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Your move                                                                  */
/* -------------------------------------------------------------------------- */

const ATTENTION_ICONS: Record<AttentionItem['kind'], LucideIcon> = {
  match: Swords,
  fee: Wallet,
  poll: BarChart3,
  jersey: Shirt,
  tournament: Trophy,
}

const ATTENTION_TONES: Record<AttentionItem['tone'], string> = {
  accent: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

export interface YourMovePanelProps {
  items: readonly AttentionItem[]
  className?: string
}

export function YourMovePanel({ items, className }: YourMovePanelProps) {
  const visible = items.slice(0, 5)

  return (
    <ArenaPanel
      kicker="Your move"
      title="Waiting on you"
      description="Personal actions first, then near-term club deadlines."
      className={className}
    >
      {visible.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={CheckCircle2}
            title="Nothing is waiting"
            description="Every challenge, fee, and club form is up to date."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((item, index) => {
            const Icon = ATTENTION_ICONS[item.kind]

            return (
              <li key={item.id}>
                <Link to={item.href} className={ROW_LINK}>
                  <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-surface-2 font-mono text-[10px] text-text-faint">
                    {index + 1}
                  </span>
                  <Icon
                    className={cn('size-4 shrink-0', ATTENTION_TONES[item.tone])}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-text-muted">
                      {item.description}
                    </span>
                  </span>
                  <ArrowRight className={ARROW} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > visible.length ? (
        <p className="border-t border-border px-4 py-2 text-[11px] text-text-faint">
          +{items.length - visible.length} more in the related modules.
        </p>
      ) : null}
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Match centre                                                               */
/* -------------------------------------------------------------------------- */

type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'info'

function matchMeta(row: ArenaMatchRow): { label: string; tone: BadgeTone } {
  if (row.status === 'pending') {
    return row.needsYou
      ? { label: 'Respond', tone: 'warning' }
      : { label: 'Invite sent', tone: 'neutral' }
  }

  if (row.status === 'accepted') {
    return { label: row.needsYou ? 'Submit score' : 'Play match', tone: 'info' }
  }

  if (row.status === 'awaiting_approval') {
    return row.needsYou
      ? { label: 'Confirm result', tone: 'warning' }
      : { label: 'In review', tone: 'neutral' }
  }

  if (row.status === 'disputed') return { label: 'Disputed', tone: 'danger' }
  if (row.status === 'confirmed' || row.status === 'auto_approved') {
    return { label: 'Final', tone: 'accent' }
  }

  return { label: row.status, tone: 'neutral' }
}

export interface MatchCentrePanelProps {
  rows: readonly ArenaMatchRow[]
  names: ReadonlyMap<string, string>
  className?: string
}

export function MatchCentrePanel({ rows, names, className }: MatchCentrePanelProps) {
  return (
    <ArenaPanel
      kicker="Head to head"
      title="Match centre"
      action={{ href: '/matches', label: 'All matches' }}
      className={className}
    >
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Swords}
            title="No matches yet"
            description="Challenge a club player and your first clash appears here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const opponent = names.get(row.opponentId) ?? 'Club player'
            const meta = matchMeta(row)
            const left = row.hoursLeft === null ? '' : ` · ${row.hoursLeft}h to review`

            return (
              <li key={row.id}>
                <Link to="/matches" className={ROW_LINK}>
                  <ArenaAvatar name={opponent} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{opponent}</span>
                    <span className="block truncate text-[11px] text-text-muted">
                      {row.direction === 'incoming' ? 'Challenged you' : 'You challenged'} ·{' '}
                      {formatDateTime(row.createdAt)}
                      {left}
                    </span>
                  </span>

                  {row.result ? (
                    <Badge tone={row.result === 'win' ? 'accent' : 'danger'}>
                      {row.result === 'win' ? 'Won' : 'Lost'}
                    </Badge>
                  ) : (
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Tournament board                                                           */
/* -------------------------------------------------------------------------- */

function dateBadge(value: string): { day: string; month: string } {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return { day: '--', month: '---' }

  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date).toUpperCase(),
  }
}

export interface TournamentBoardProps {
  tournaments: readonly TournamentRecord[]
  /** Local `YYYY-MM-DD` used for the countdown. */
  today: string
  className?: string
}

export function TournamentBoard({ tournaments, today, className }: TournamentBoardProps) {
  return (
    <ArenaPanel
      kicker="Draws"
      title="Tournament board"
      action={{ href: '/tournaments', label: 'All events' }}
      className={className}
    >
      {tournaments.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Trophy}
            title="No upcoming tournaments"
            description="Published events appear here when tournament staff schedule them."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {tournaments.slice(0, 3).map((tournament) => {
            const day = dateBadge(tournament.starts_on)
            const days = daysBetween(today, tournament.starts_on)
            const countdown =
              tournament.status === 'in_progress'
                ? 'Live now'
                : days === null
                  ? null
                  : days <= 0
                    ? 'Today'
                    : days === 1
                      ? 'Tomorrow'
                      : `In ${days} days`

            return (
              <li key={tournament.id}>
                <Link to={`/tournaments/${tournament.id}`} className={ROW_LINK}>
                  <span className="grid w-11 shrink-0 place-items-center rounded-sm border border-border bg-surface-2 py-1">
                    <span className="text-[9px] uppercase tracking-[0.1em] text-text-faint">
                      {day.month}
                    </span>
                    <span className="font-mono text-base font-semibold leading-none tabular-nums text-text">
                      {day.day}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {tournament.name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-muted">
                      <span>{formatDateRange(tournament.starts_on, tournament.ends_on)}</span>
                      {tournament.venue ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden="true" />
                          {tournament.venue}
                        </span>
                      ) : null}
                    </span>
                    {tournament.registration_deadline ? (
                      <span className="mt-0.5 block text-[11px] text-text-faint">
                        Registration closes {formatDateTime(tournament.registration_deadline)}
                      </span>
                    ) : null}
                  </span>

                  {countdown ? (
                    <Badge
                      tone={tournament.status === 'in_progress' ? 'accent' : 'info'}
                      className="shrink-0"
                    >
                      {countdown}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Club feed                                                                  */
/* -------------------------------------------------------------------------- */

export type FeedKind = 'news' | 'poll' | 'jersey'

export interface FeedItem {
  id: string
  kind: FeedKind
  title: string
  description: string
  href: string
  meta: string | null
}

const FEED_ICONS: Record<FeedKind, LucideIcon> = {
  news: Megaphone,
  poll: BarChart3,
  jersey: Shirt,
}

const FEED_LABELS: Record<FeedKind, string> = {
  news: 'News',
  poll: 'Poll',
  jersey: 'Jersey',
}

export interface ClubFeedPanelProps {
  items: readonly FeedItem[]
  className?: string
}

export function ClubFeedPanel({ items, className }: ClubFeedPanelProps) {
  return (
    <ArenaPanel
      kicker="Club pulse"
      title="Around the arena"
      action={{ href: '/announcements', label: 'All news' }}
      className={className}
    >
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Megaphone}
            title="Nothing new"
            description="Published club news, open votes, and jersey projects appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const Icon = FEED_ICONS[item.kind]

            return (
              <li key={item.id}>
                <Link to={item.href} className={cn(ROW_LINK, 'items-start')}>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-sm bg-surface-2 text-text-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                        {FEED_LABELS[item.kind]}
                      </span>
                      {item.meta ? (
                        <span className="text-[10px] text-text-faint">{item.meta}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium text-text">{item.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-text-muted">
                      {item.description}
                    </span>
                  </span>

                  <ArrowRight className={cn(ARROW, 'mt-1')} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Ladder                                                                     */
/* -------------------------------------------------------------------------- */

function LadderRow({ row, own }: { row: LeaderboardRow; own: boolean }) {
  const tier = tierFor(row.sp).tier

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 px-4 py-2',
        own && 'border-l-2 border-l-accent bg-accent-soft',
      )}
    >
      <span
        className={cn(
          'w-5 shrink-0 font-mono text-[11px] tabular-nums',
          row.position === 1 ? 'text-accent' : 'text-text-faint',
        )}
      >
        {row.position}
      </span>

      <ArenaAvatar name={row.fullName} size="sm" tone={tier.tone} ring={row.position <= 3} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[13px]',
            own ? 'font-medium text-accent' : 'text-text',
          )}
        >
          {row.fullName}
        </span>
        <span
          className={cn(
            'block text-[10px] uppercase tracking-[0.08em]',
            TIER_TEXT_CLASSES[tier.tone],
          )}
        >
          {tier.rankTitle} · #{row.divisionPosition}
        </span>
      </span>

      <span className="shrink-0 font-mono text-xs tabular-nums text-text">
        {row.sp.toLocaleString()}
      </span>
    </li>
  )
}

export interface LadderBoardProps {
  rows: readonly LeaderboardRow[]
  ownPlayerId: string | null
  limit?: number
  className?: string
}

export function LadderBoard({ rows, ownPlayerId, limit = 6, className }: LadderBoardProps) {
  const top = rows.slice(0, limit)
  const own = ownPlayerId ? rows.find((row) => row.playerId === ownPlayerId) : undefined
  const ownInTop = own ? top.some((row) => row.playerId === own.playerId) : true

  return (
    <ArenaPanel
      kicker="Club ladder"
      title="Ranks"
      action={{ href: '/shuttlepower', label: 'Full ladder' }}
      className={className}
    >
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Zap}
            title="No SP accounts yet"
            description="A player receives 1,000 SP when their registration is approved."
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {top.map((row) => (
              <LadderRow key={row.playerId} row={row} own={row.playerId === ownPlayerId} />
            ))}
            {own && !ownInTop ? <LadderRow row={own} own /> : null}
          </ul>
          <p className="border-t border-border px-4 py-2 text-[10px] leading-snug text-text-faint">
            {ARENA_DIVISION_NOTICE}
          </p>
        </>
      )}
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Rivals                                                                     */
/* -------------------------------------------------------------------------- */

export interface RivalsPanelProps {
  rivals: readonly RivalRow[]
  className?: string
}

export function RivalsPanel({ rivals, className }: RivalsPanelProps) {
  return (
    <ArenaPanel
      kicker="In reach"
      title="Rivals"
      description="The nearest balances and your next step up."
      className={className}
    >
      {rivals.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Target}
            title="No rivals to chase"
            description="Once more players have SP, the closest ratings appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rivals.map((rival) => (
            <li key={rival.playerId} className="flex items-center gap-2.5 px-4 py-2.5">
              <ArenaAvatar name={rival.fullName} size="sm" tone={tierFor(rival.sp).tier.tone} />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-text">{rival.fullName}</span>
                <span className="block text-[11px] text-text-muted">
                  <span className="font-mono tabular-nums">#{rival.position}</span> ·{' '}
                  {rival.delta > 0
                    ? `${rival.delta.toLocaleString()} SP ahead`
                    : `${Math.abs(rival.delta).toLocaleString()} SP behind`}
                </span>
              </span>

              <Link
                to="/matches"
                className="shrink-0 rounded-sm px-2 py-1 text-[11px] font-medium text-accent transition-colors duration-fast hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                Challenge
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Club duties                                                                */
/* -------------------------------------------------------------------------- */

export interface ClubDutyPanelProps {
  session: TrainingSessionRecord | null
  attended: number
  recorded: number
  periodLabel: string | null
  dueOn: string | null
  amount: string | null
  fee: FeeSummary | null
  className?: string
}

export function ClubDutyPanel({
  session,
  attended,
  recorded,
  periodLabel,
  dueOn,
  amount,
  fee,
  className,
}: ClubDutyPanelProps) {
  return (
    <ArenaPanel
      kicker="Club duties"
      title="Training and dues"
      action={{ href: '/training', label: 'Open' }}
      className={className}
    >
      <div className="divide-y divide-border">
        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Next session</p>

          {session ? (
            <>
              <p className="mt-1 text-sm font-medium text-text">{session.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
                <Clock className="size-3 shrink-0" aria-hidden="true" />
                {formatDateTime(session.starts_at)}
              </p>
              {session.venue ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  {session.venue}
                </p>
              ) : null}
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-faint">
                <Users className="size-3 shrink-0" aria-hidden="true" />
                {recorded === 0
                  ? 'No attendance recorded for you yet.'
                  : `Attended ${attended} of ${recorded} recorded.`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-text-muted">
              Training staff have not scheduled the next session yet.
            </p>
          )}
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Training fee</p>

          {periodLabel === null || amount === null || fee === null ? (
            <p className="mt-1 text-[11px] text-text-muted">
              A trainer opens a fee period before payments can be recorded.
            </p>
          ) : (
            <>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-text">{periodLabel}</p>
                <StatusBadge status={fee.state} />
              </div>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {dueOn ? `Due ${formatDateTime(dueOn)}` : 'Payments recorded by a trainer.'}
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-text">
                {formatMoney(fee.paid)}
                <span className="text-text-faint"> of {formatMoney(Number(amount))}</span>
              </p>
              {fee.state !== 'paid' ? (
                <p className="mt-0.5 text-[11px] text-warning">
                  {formatMoney(fee.remaining)} remaining
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

export interface StaffSummaryRow {
  id: string
  label: string
  description: string
  href: string
  count: number
}

export interface OperationsPanelProps {
  rows: readonly StaffSummaryRow[]
  className?: string
}

export function OperationsPanel({ rows, className }: OperationsPanelProps) {
  return (
    <ArenaPanel kicker="Operations" title="Club work queued" className={className}>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id}>
            <Link to={row.href} className={ROW_LINK}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text">
                  {row.label}
                </span>
                <span className="block truncate text-[11px] text-text-muted">
                  {row.description}
                </span>
              </span>

              <Badge tone={row.count > 0 ? 'warning' : 'neutral'}>{row.count}</Badge>
              <ArrowRight className={ARROW} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </ArenaPanel>
  )
}

/* -------------------------------------------------------------------------- */
/* Pulse strip                                                                */
/* -------------------------------------------------------------------------- */

export interface ArenaPulseProps {
  players: number
  events: number
  waiting: number
  className?: string
}

export function ArenaPulse({ players, events, waiting, className }: ArenaPulseProps) {
  const stats = [
    { icon: Users, label: `${players} fighter${players === 1 ? '' : 's'}` },
    { icon: Trophy, label: `${events} event${events === 1 ? '' : 's'} open` },
    { icon: Swords, label: `${waiting} waiting on you` },
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border bg-surface-1 px-4 py-2.5',
        className,
      )}
    >
      {stats.map((stat) => (
        <span
          key={stat.label}
          className="inline-flex items-center gap-1.5 text-[11px] text-text-muted"
        >
          <stat.icon className="size-3.5 text-text-faint" aria-hidden="true" />
          {stat.label}
        </span>
      ))}

      <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text-muted">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
        Season in play · ranks display-only
      </span>
    </div>
  )
}
