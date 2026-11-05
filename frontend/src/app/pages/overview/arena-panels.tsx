import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
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

import {
  ArenaAvatar,
  ArenaPanel,
  FormStrip,
  LevelRing,
  PowerMeter,
  RankBadge,
  RankSigil,
  SectionHeading,
  StreakTag,
} from '@/components/arena/arena-ui'
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
import type { PlayerRecord } from '@/features/players/types'
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

/** An open row on the page background — no card per item. */
const ROW =
  'row-action group flex items-center gap-3 rounded-sm px-3 py-3 transition-colors duration-fast hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-inset'

const ARROW =
  'size-3.5 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-accent'

const TIER_TEXT_CLASSES: Record<ArenaTierTone, string> = {
  neutral: 'text-text-faint',
  info: 'text-info',
  accent: 'text-accent',
  warning: 'text-warning',
  bright: 'text-text',
}

/* -------------------------------------------------------------------------- */
/* Hero: who you are, where you stand                                         */
/* -------------------------------------------------------------------------- */

export interface ArenaHeroProps {
  firstName: string
  player: PlayerRecord | null
  sp: number | null
  position: number | null
  totalPlayers: number
  divisionPosition: number | null
  record: ArenaRecord
  progress: TierProgress | null
  roles: readonly Role[]
  status: AccountStatus
  waiting: number
}

export function ArenaHero({
  firstName,
  player,
  sp,
  position,
  totalPlayers,
  divisionPosition,
  record,
  progress,
  roles,
  status,
  waiting,
}: ArenaHeroProps) {
  return (
    <section className="arena-hero relative overflow-hidden rounded-lg border border-border shadow-panel">
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              <span aria-hidden="true" className="h-px w-5 bg-accent" />
              Arena · {waiting > 0 ? `${waiting} waiting on you` : 'court is clear'}
            </p>

            <h1 className="mt-2 text-[26px] font-semibold leading-[1.08] tracking-tight text-text sm:text-3xl">
              Back on court, {firstName}.
            </h1>

            {player ? (
              <div className="mt-4 flex items-center gap-3">
                <LevelRing
                  progress={progress?.progress ?? 0}
                  tone={progress?.tier.tone ?? 'neutral'}
                  size={56}
                >
                  <ArenaAvatar name={player.full_name} size="md" tone={progress?.tier.tone} />
                </LevelRing>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold leading-tight text-text">
                    {player.full_name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-faint">
                    {player.player_code}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {progress ? <RankBadge tier={progress.tier} /> : null}
                    <Badge
                      tone={
                        status === 'approved'
                          ? 'accent'
                          : status === 'pending'
                            ? 'warning'
                            : 'danger'
                      }
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
              </div>
            ) : (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
                Your account is not linked to a player record yet. An admin links it, and your clash
                card appears here.
              </p>
            )}
          </div>

          {player ? (
            <div className="flex shrink-0 items-stretch gap-4 rounded-md border border-border bg-surface-2 px-4 py-3 backdrop-blur-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">
                  ShuttlePower
                </p>
                <p className="mt-1 animate-score-pop font-mono text-[34px] font-semibold leading-none tabular-nums text-text">
                  {sp === null ? '—' : sp.toLocaleString()}
                </p>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {progress ? progress.tier.blurb : 'Awaiting an SP account'}
                </p>
              </div>

              <div className="w-px self-stretch bg-border" aria-hidden="true" />

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">Club rank</p>
                <p className="mt-1 animate-score-pop font-mono text-[34px] font-semibold leading-none tabular-nums text-accent">
                  {position === null ? '—' : `#${position}`}
                </p>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  of {totalPlayers} ranked
                  {divisionPosition !== null ? ` · #${divisionPosition} in division` : ''}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {player && progress ? (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <RankSigil tier={progress.tier} />

              <p className="font-mono text-[11px] tabular-nums text-text-faint">
                {progress.next ? (
                  <>
                    <span className="text-text">{progress.spToNext}</span> SP to{' '}
                    {progress.next.rankTitle}
                  </>
                ) : (
                  'Top division · every point defends the spot'
                )}
              </p>
            </div>

            <PowerMeter
              className="mt-2.5"
              progress={progress.progress}
              label={`${progress.tier.rankTitle} division progress`}
            />

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <dl className="flex items-center gap-5">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
                    Played
                  </dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-text">
                    {record.played}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Wins</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-text">
                    {record.wins}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
                    Win rate
                  </dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-text">
                    {record.winRate === null ? '—' : `${Math.round(record.winRate * 100)}%`}
                  </dd>
                </div>
              </dl>

              <span aria-hidden="true" className="hidden h-8 w-px bg-border sm:block" />

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
                  Form
                </span>
                <FormStrip form={record.form} />
              </div>

              {record.streak ? (
                <StreakTag kind={record.streak.kind} length={record.streak.length} />
              ) : null}

              <div className="ml-auto flex flex-wrap items-center gap-2">
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
            </div>
          </div>
        ) : null}
      </div>
    </section>
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

/** The quest log: personal actions first, then near-term club deadlines. */
export function YourMovePanel({ items, className }: YourMovePanelProps) {
  const visible = items.slice(0, 5)

  return (
    <section className={cn('', className)}>
      <SectionHeading
        index="01"
        title="Waiting on you"
        description="Everything that needs a move from you, in the order it costs you."
        action={
          items.length > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-text-faint">
              {items.length} open
            </span>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={CheckCircle2}
          title="Court is clear"
          description="Every challenge, fee, and club form is up to date."
        />
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {visible.map((item, index) => {
            const Icon = ATTENTION_ICONS[item.kind]

            return (
              <li key={item.id}>
                <Link to={item.href} className={ROW}>
                  <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-surface-1">
                    <Icon className={cn('size-4', ATTENTION_TONES[item.tone])} aria-hidden="true" />
                  </span>
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
        <p className="px-3 pt-2 text-[11px] text-text-faint">
          +{items.length - visible.length} more in the related modules.
        </p>
      ) : null}
    </section>
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
    <section className={className}>
      <SectionHeading
        index="02"
        title="Match centre"
        action={
          <Link
            to="/matches"
            className="group inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors duration-fast hover:text-accent"
          >
            All matches
            <ArrowRight
              className="size-3 transition-transform duration-fast group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={Swords}
          title="No matches yet"
          description="Challenge a club player and your first clash appears here."
        />
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {rows.map((row) => {
            const opponent = names.get(row.opponentId) ?? 'Club player'
            const meta = matchMeta(row)
            const left = row.hoursLeft === null ? '' : ` · ${row.hoursLeft}h to review`

            return (
              <li key={row.id}>
                <Link to="/matches" className={ROW}>
                  <ArenaAvatar
                    name={opponent}
                    size="sm"
                    tone={row.result === 'win' ? 'accent' : 'neutral'}
                  />
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
    </section>
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
    <section className={className}>
      <SectionHeading
        index="03"
        title="Draws ahead"
        description="Published events and what the bracket is waiting for."
        action={
          <Link
            to="/tournaments"
            className="group inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors duration-fast hover:text-accent"
          >
            All events
            <ArrowRight
              className="size-3 transition-transform duration-fast group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        }
      />

      {tournaments.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={Trophy}
          title="No upcoming tournaments"
          description="Published events appear here when tournament staff schedule them."
        />
      ) : (
        <ul className="mt-1 divide-y divide-border">
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
                <Link to={`/tournaments/${tournament.id}`} className={ROW}>
                  <span className="grid w-12 shrink-0 place-items-center rounded-sm border border-border bg-surface-2 py-1">
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
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-text-muted">
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
    </section>
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
    <section className={className}>
      <SectionHeading
        title="Around the arena"
        action={
          <Link
            to="/announcements"
            className="group inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors duration-fast hover:text-accent"
          >
            All news
            <ArrowRight
              className="size-3 transition-transform duration-fast group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={Megaphone}
          title="Nothing new"
          description="Published club news, open votes, and jersey projects appear here."
        />
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {items.map((item) => {
            const Icon = FEED_ICONS[item.kind]

            return (
              <li key={item.id}>
                <Link to={item.href} className={cn(ROW, 'items-start')}>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-surface-1 text-text-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                        {FEED_LABELS[item.kind]}
                      </span>
                      {item.meta ? (
                        <span className="truncate text-[10px] text-text-faint">{item.meta}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium text-text">{item.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-text-muted">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Ladder                                                                     */
/* -------------------------------------------------------------------------- */

const PODIUM_TONES = ['gold', 'silver', 'bronze'] as const
const PODIUM_TEXT = ['text-gold', 'text-silver', 'text-bronze'] as const

function LadderRow({ row, own }: { row: LeaderboardRow; own: boolean }) {
  const tier = tierFor(row.sp).tier
  const medal = row.position <= 3 ? PODIUM_TONES[row.position - 1] : null

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-fast hover:bg-surface-2',
        own && 'border-l-2 border-l-accent bg-accent-soft',
      )}
    >
      <span
        className={cn(
          'w-6 shrink-0 font-mono text-[11px] tabular-nums',
          medal ? PODIUM_TEXT[row.position - 1] : 'text-text-faint',
        )}
      >
        {String(row.position).padStart(2, '0')}
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

/** The only boxed panel on the home page: the club scoreboard. */
export function LadderBoard({ rows, ownPlayerId, limit = 6, className }: LadderBoardProps) {
  const top = rows.slice(0, limit)
  const own = ownPlayerId ? rows.find((row) => row.playerId === ownPlayerId) : undefined
  const ownInTop = own ? top.some((row) => row.playerId === own.playerId) : true

  return (
    <ArenaPanel
      accent
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
    <section className={className}>
      <SectionHeading title="In reach" description="The nearest balances and your next step up." />

      {rivals.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={Target}
          title="No rivals to chase"
          description="Once more players have SP, the closest ratings appear here."
        />
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {rivals.map((rival) => (
            <li key={rival.playerId} className="flex items-center gap-2.5 px-3 py-2.5">
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
    </section>
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
  const attendanceRatio = recorded > 0 ? attended / recorded : 0

  return (
    <section className={className}>
      <SectionHeading
        title="Club duties"
        action={
          <Link
            to="/training"
            className="group inline-flex items-center gap-1 text-[11px] font-medium text-text-muted transition-colors duration-fast hover:text-accent"
          >
            Open
            <ArrowRight
              className="size-3 transition-transform duration-fast group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        }
      />

      <div className="mt-1 divide-y divide-border">
        <div className="px-3 py-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-text-faint">
            <CalendarCheck className="size-3 text-accent" aria-hidden="true" />
            Next session
          </p>

          {session ? (
            <>
              <p className="mt-1.5 text-sm font-medium text-text">{session.title}</p>
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
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-faint">
                <Users className="size-3 shrink-0" aria-hidden="true" />
                {recorded === 0
                  ? 'No attendance recorded for you yet.'
                  : `Attended ${attended} of ${recorded}.`}
              </p>
              {recorded > 0 ? (
                <PowerMeter
                  className="mt-2"
                  segments={12}
                  progress={attendanceRatio}
                  label="Your training attendance"
                />
              ) : null}
            </>
          ) : (
            <p className="mt-1.5 text-[11px] text-text-muted">
              Training staff have not scheduled the next session yet.
            </p>
          )}
        </div>

        <div className="px-3 py-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-text-faint">
            <Wallet className="size-3 text-accent" aria-hidden="true" />
            Training fee
          </p>

          {periodLabel === null || amount === null || fee === null ? (
            <p className="mt-1.5 text-[11px] text-text-muted">
              A trainer opens a fee period before payments can be recorded.
            </p>
          ) : (
            <>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-text">{periodLabel}</p>
                <StatusBadge status={fee.state} />
              </div>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {dueOn ? `Due ${formatDateTime(dueOn)}` : 'Payments recorded by a trainer.'}
              </p>
              <p className="mt-1.5 font-mono text-sm tabular-nums text-text">
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
    </section>
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
    <section className={cn('', className)}>
      <SectionHeading
        index="04"
        title="Control room"
        description="Club work queued for your roles."
      />

      <ul className="mt-1 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id}>
            <Link to={row.href} className={ROW}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text">
                  {row.label}
                </span>
                <span className="block truncate text-[11px] text-text-muted">
                  {row.description}
                </span>
              </span>

              <span
                className={cn(
                  'grid min-w-7 place-items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
                  row.count > 0
                    ? 'border-warning-soft bg-warning-soft text-warning'
                    : 'border-border bg-surface-1 text-text-faint',
                )}
              >
                {row.count}
              </span>
              <ArrowRight className={ARROW} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Unused guards                                                              */
/* -------------------------------------------------------------------------- */

/** Kept for pages that still want the compact pulse strip. */
export function ArenaPulse({
  players,
  events,
  waiting,
  className,
}: {
  players: number
  events: number
  waiting: number
  className?: string
}) {
  const stats = [
    { icon: Users, label: `${players} fighter${players === 1 ? '' : 's'}` },
    { icon: Trophy, label: `${events} event${events === 1 ? '' : 's'} open` },
    { icon: Swords, label: `${waiting} waiting on you` },
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border bg-surface-1 px-4 py-2.5 shadow-panel',
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
        <span aria-hidden="true" className="size-1.5 animate-edge-pulse rounded-full bg-accent" />
        Season in play · ranks display-only
      </span>
    </div>
  )
}

/** Small accent rule used by pages that want a section marker without a heading. */
export function ArenaRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-px w-full bg-gradient-to-r from-accent to-transparent', className)}
    />
  )
}
