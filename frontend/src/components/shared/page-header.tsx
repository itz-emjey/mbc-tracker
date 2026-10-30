import type * as React from 'react'

import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons or filters aligned to the right on desktop. */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-text">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-text-muted">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
