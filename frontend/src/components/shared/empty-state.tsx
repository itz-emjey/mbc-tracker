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

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-faint">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      ) : null}

      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
