import type * as React from 'react'

import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Small accent label above the title, e.g. "Club ladder". */
  kicker?: string
  /** Buttons or filters aligned to the right on desktop. */
  actions?: React.ReactNode
  /** Optional scoreboard numbers pinned under the hero. */
  stats?: readonly { label: string; value: string }[]
  /** Extra content between the title block and the actions. */
  children?: React.ReactNode
  className?: string
}

/**
 * The one page header for the whole product.
 * A hero band with court lines, a small caps kicker, and one oversized title.
 * It sits above the page's sections so no page starts as a stack of cards.
 */
export function PageHeader({
  title,
  description,
  kicker,
  actions,
  stats,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'arena-hero relative overflow-hidden rounded-lg border border-border shadow-panel',
        className,
      )}
    >
      <div className="relative z-10 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {kicker ? (
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                <span aria-hidden="true" className="h-px w-5 bg-accent" />
                {kicker}
              </p>
            ) : null}

            <h1 className="mt-2 text-[26px] font-semibold leading-[1.08] tracking-tight text-text sm:text-3xl">
              {title}
            </h1>

            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        {stats && stats.length > 0 ? (
          <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
                  {stat.label}
                </dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-text">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  )
}
