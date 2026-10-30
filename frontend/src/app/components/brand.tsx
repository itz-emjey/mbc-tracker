import { cn } from '@/lib/cn'

export interface BrandProps {
  /** Logo only, no wordmark (icon rail). */
  compact?: boolean
  /** Hide the club name line where space is tight (mobile top bar). */
  showClub?: boolean
  className?: string
}

/** Wordmark + club name. Text only — no logo asset, no emoji. */
export function Brand({ compact = false, showClub = true, className }: BrandProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-[11px] font-semibold tracking-wide text-accent"
      >
        MBC
      </span>

      {compact ? null : (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-text">MBC Arena</p>
          {showClub ? (
            <p className="truncate text-[9px] uppercase tracking-[0.08em] text-text-faint">
              Matag-ob Badminton Club
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
