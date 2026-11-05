import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  /** The single next action a user can take. */
  action?: React.ReactNode
  className?: string
}

/**
 * An empty court: dashed boundary, four corner ticks, one way forward.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-surface-1 px-6 py-10 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-3 size-3 border-l border-t border-border-strong"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3 size-3 border-r border-t border-border-strong"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 left-3 size-3 border-b border-l border-border-strong"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3 size-3 border-b border-r border-border-strong"
      />

      {Icon ? (
        <span className="mb-3 grid size-11 place-items-center rounded-pill border border-border bg-surface-2 text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      ) : null}

      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-text-muted">{description}</p>

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
