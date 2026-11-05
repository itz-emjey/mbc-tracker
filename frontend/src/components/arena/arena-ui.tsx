import { Activity, ArrowRight, Crown, Feather, Flame, Zap, type LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { ArenaTier, ArenaTierId, ArenaTierTone } from '@/domain/arena'
import { cn } from '@/lib/cn'
import { getInitials } from '@/lib/format'

/**
 * Arena surface primitives.
 *
 * Presentation only. The vocabulary is a club scoreboard: numbered sections,
 * a small caps kicker, mono numerals, and one accent rail. Tier styling is
 * shared by the home hub, the ladder, and profiles so a player looks the same
 * everywhere. Colours come from the design tokens — no raw values here.
 */

const BADGE_TONES: Record<ArenaTierTone, 'outline' | 'info' | 'accent' | 'warning' | 'neutral'> = {
  neutral: 'outline',
  info: 'info',
  accent: 'accent',
  warning: 'warning',
  bright: 'neutral',
}

const TIER_RINGS: Record<ArenaTierTone, string> = {
  neutral: 'ring-border-strong',
  info: 'ring-info',
  accent: 'ring-accent',
  warning: 'ring-warning',
  bright: 'ring-text',
}

const TIER_TEXT: Record<ArenaTierTone, string> = {
  neutral: 'text-text-faint',
  info: 'text-info',
  accent: 'text-accent',
  warning: 'text-warning',
  bright: 'text-text',
}

const TIER_ICONS: Record<ArenaTierId, LucideIcon> = {
  feather: Feather,
  rally: Activity,
  smash: Zap,
  apex: Flame,
  legend: Crown,
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                            */
/* -------------------------------------------------------------------------- */

export interface SectionHeadingProps {
  /** Two-digit section number, e.g. `01`. Purely a reading aid. */
  index?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * The page's second level. Sits above content that is *not* boxed, so a page
 * can hold grouped lists instead of a wall of equal cards.
 */
export function SectionHeading({
  index,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn('flex items-end justify-between gap-4 border-b border-border pb-2', className)}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {index ? (
            <span className="font-mono text-[10px] font-semibold tabular-nums tracking-[0.08em] text-accent">
              {index}
            </span>
          ) : null}
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-text-muted">{description}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export interface ArenaStat {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'accent' | 'warning' | 'danger'
}

const STAT_TONES: Record<NonNullable<ArenaStat['tone']>, string> = {
  default: 'text-text',
  accent: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
}

/**
 * A scoreboard strip: four headline numbers divided by hairlines. Used at the
 * top of module pages so the page states its shape before the list does.
 */
export function ArenaStatStrip({
  stats,
  className,
}: {
  stats: readonly ArenaStat[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-md border border-border bg-border shadow-panel sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="relative bg-surface-1 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-text-faint">{stat.label}</dt>
          <dd
            className={cn(
              'mt-1.5 animate-score-pop font-mono text-xl font-semibold leading-none tabular-nums',
              STAT_TONES[stat.tone ?? 'default'],
            )}
          >
            {stat.value}
          </dd>
          {stat.detail ? (
            <dd className="mt-1.5 text-[11px] leading-snug text-text-muted">{stat.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  )
}

/* -------------------------------------------------------------------------- */
/* Panels                                                                     */
/* -------------------------------------------------------------------------- */

export interface ArenaPanelProps {
  /** Small caps label above the title. */
  kicker?: string
  title: string
  description?: string
  /** A quiet "see all" link on the right of the header. */
  action?: { href: string; label: string }
  /** Draws the accent rail across the top: one per page, the main panel. */
  accent?: boolean
  /** Hides the panel header when a surrounding stage already names the board. */
  headerless?: boolean
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

export function ArenaPanel({
  kicker,
  title,
  description,
  action,
  accent = false,
  headerless = false,
  className,
  bodyClassName,
  children,
}: ArenaPanelProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-md border border-border bg-surface-1 shadow-panel',
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-80"
        />
      ) : null}

      {headerless ? null : (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {kicker ? (
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-text-faint">
                <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                {kicker}
              </p>
            ) : null}
            <h2 className="mt-1 truncate text-sm font-semibold tracking-tight text-text">
              {title}
            </h2>
            {description ? <p className="mt-1 text-xs text-text-muted">{description}</p> : null}
          </div>

          {action ? (
            <Link
              to={action.href}
              className="group mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-sm text-[11px] font-medium text-text-muted transition-colors duration-fast hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              {action.label}
              <ArrowRight
                className="size-3 transition-transform duration-fast group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ) : null}
        </header>
      )}

      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProgressTrackProps {
  /** 0–1. Clamped. */
  value: number
  label: string
  /** An unlabeled bar when the number is already on screen. */
  tone?: 'accent' | 'info' | 'warning' | 'gold'
  className?: string
  /** Animated leading edge; off for dense table cells. */
  edge?: boolean
}

const TRACK_TONES: Record<NonNullable<ProgressTrackProps['tone']>, string> = {
  accent: 'bg-accent',
  info: 'bg-info',
  warning: 'bg-warning',
  gold: 'bg-gold',
}

/** A continuous track — for placement, attendance, and payment progress. */
export function ProgressTrack({
  value,
  label,
  tone = 'accent',
  className,
  edge = true,
}: ProgressTrackProps) {
  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-pill bg-surface-3', className)}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 rounded-pill transition-[width] duration-slow ease-arena',
          TRACK_TONES[tone],
        )}
        style={{ width: `${ratio * 100}%` }}
      >
        {edge && ratio > 0.02 ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-1 animate-edge-pulse rounded-pill bg-text opacity-60"
          />
        ) : null}
      </span>
    </div>
  )
}

export interface PowerMeterProps {
  /** 0–1 progress through the current division. */
  progress: number
  label: string
  segments?: number
  className?: string
}

/** Segmented SP meter — filled segments read as "games" rather than a bar. */
export function PowerMeter({ progress, label, segments = 18, className }: PowerMeterProps) {
  const ratio = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const filled = ratio === 0 ? 0 : Math.max(1, Math.round(ratio * segments))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('flex gap-[3px]', className)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{ transitionDelay: `${index * 12}ms` }}
          className={cn(
            'h-1.5 flex-1 rounded-pill transition-colors duration-slow',
            index < filled ? 'bg-accent' : 'bg-surface-3',
            index === filled - 1 && 'shadow-accent',
          )}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Level ring                                                                 */
/* -------------------------------------------------------------------------- */

export interface LevelRingProps {
  /** 0–1. */
  progress: number
  /** Pixel diameter. */
  size?: number
  tone?: ArenaTierTone
  className?: string
  children?: React.ReactNode
}

const RING_STROKES: Record<ArenaTierTone, string> = {
  neutral: 'var(--color-text-faint)',
  info: 'var(--color-info)',
  accent: 'var(--color-accent)',
  warning: 'var(--color-warning)',
  bright: 'var(--color-text)',
}

/**
 * A conic progress ring around an avatar — the one "game HUD" flourish, used
 * only where a balance has a next level.
 */
export function LevelRing({
  progress,
  size = 64,
  tone = 'accent',
  className,
  children,
}: LevelRingProps) {
  const ratio = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING_STROKES[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Rank + identity                                                            */
/* -------------------------------------------------------------------------- */

export interface RankBadgeProps {
  tier: ArenaTier
  className?: string
}

/** Division pill. Visible wherever a balance is compared with others. */
export function RankBadge({ tier, className }: RankBadgeProps) {
  const Icon = TIER_ICONS[tier.id]

  return (
    <Badge
      tone={BADGE_TONES[tier.tone]}
      className={cn('gap-1', className)}
      title={`${tier.rankTitle} — ${tier.label} division`}
      aria-label={`${tier.rankTitle}, ${tier.label} division`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {tier.rankTitle}
    </Badge>
  )
}

export interface RankSigilProps {
  tier: ArenaTier
  className?: string
}

/** Larger division mark for a hero or a profile, with the division label. */
export function RankSigil({ tier, className }: RankSigilProps) {
  const Icon = TIER_ICONS[tier.id]

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'grid size-7 place-items-center rounded-sm border border-border bg-surface-2',
          TIER_TEXT[tier.tone],
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className={cn('block text-xs font-semibold', TIER_TEXT[tier.tone])}>
          {tier.rankTitle}
        </span>
        <span className="block text-[10px] uppercase tracking-[0.1em] text-text-faint">
          {tier.label} division
        </span>
      </span>
    </span>
  )
}

export interface ArenaAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'xl'
  tone?: ArenaTierTone
  /** Draws a division-coloured ring; used for your own card and the podium. */
  ring?: boolean
  className?: string
}

const AVATAR_SIZES: Record<NonNullable<ArenaAvatarProps['size']>, string> = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  xl: 'size-14 text-base',
}

export function ArenaAvatar({
  name,
  size = 'md',
  tone = 'neutral',
  ring = false,
  className,
}: ArenaAvatarProps) {
  return (
    <Avatar
      size="md"
      className={cn(
        AVATAR_SIZES[size],
        ring && 'ring-2 ring-offset-2 ring-offset-surface-1',
        ring && TIER_RINGS[tone],
        className,
      )}
    >
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

/* -------------------------------------------------------------------------- */
/* Form and streaks                                                           */
/* -------------------------------------------------------------------------- */

export interface FormStripProps {
  /** Newest first. */
  form: readonly ('win' | 'loss')[]
  className?: string
}

/** The last few results as W/L pips — the "form" of a scoreboard. */
export function FormStrip({ form, className }: FormStripProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {form.length === 0 ? (
        <span className="text-[11px] text-text-faint">No decided matches yet</span>
      ) : (
        form.map((result, index) => (
          <span
            key={`${result}-${index}`}
            title={result === 'win' ? 'Win' : 'Loss'}
            className={cn(
              'grid size-5 place-items-center rounded-sm border text-[10px] font-semibold',
              result === 'win'
                ? 'border-accent-soft bg-accent-soft text-accent'
                : 'border-danger-soft bg-danger-soft text-danger',
            )}
          >
            {result === 'win' ? 'W' : 'L'}
          </span>
        ))
      )}
    </span>
  )
}

export interface StreakTagProps {
  kind: 'win' | 'loss'
  length: number
  className?: string
}

export function StreakTag({ kind, length, className }: StreakTagProps) {
  return (
    <Badge tone={kind === 'win' ? 'accent' : 'danger'} className={className}>
      <Flame className="size-3" aria-hidden="true" />
      {length} {kind === 'win' ? 'win' : 'loss'} run
    </Badge>
  )
}
