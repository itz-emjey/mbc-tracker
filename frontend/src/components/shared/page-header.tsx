import type * as React from 'react'

import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Small accent label above the title, e.g. "Club ladder". */
  kicker?: string
  /** Buttons or filters aligned to the right on desktop. */
  actions?: React.ReactNode
  className?: string
}

/**
 * The one page header for the whole product.
 * Kicker + large title + rule: the arena's top-of-page banner without adding a
 * second navigation layer.
 */
export function PageHeader({ title, description, kicker, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {kicker ? (
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
            <span aria-hidden="true" className="h-px w-6 bg-accent" />
            {kicker}
          </p>
        ) : null}

        <h1 className="truncate text-2xl font-semibold tracking-tight text-text">{title}</h1>

        {description ? (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-text-muted">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
