import { AlertTriangle } from 'lucide-react'
import type * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export interface ErrorStateProps {
  title?: string
  /** Plain-language explanation. Never dump raw stack traces at players. */
  description: string
  onRetry?: () => void
  retryLabel?: string
  action?: React.ReactNode
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-danger-soft bg-danger-soft px-5 py-4',
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
      </div>

      {(onRetry ?? action) ? (
        <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
          {action}
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
