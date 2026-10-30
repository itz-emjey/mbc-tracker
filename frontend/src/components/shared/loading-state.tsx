import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/cn'

export interface LoadingStateProps {
  /** Announced to assistive technology. */
  label?: string
  /** `skeleton` for page regions, `spinner` for inline/panel loads. */
  variant?: 'skeleton' | 'spinner'
  /** Number of skeleton rows. */
  rows?: number
  className?: string
}

export function LoadingState({
  label = 'Loading',
  variant = 'skeleton',
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center justify-center gap-2 py-10 text-sm text-text-muted',
          className,
        )}
      >
        <Spinner size="md" />
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" className={cn('space-y-2', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
