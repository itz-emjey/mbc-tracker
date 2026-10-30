import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/cn'

const spinnerSizes = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
} as const

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof spinnerSizes
  /** Announce the loading state to assistive technology. */
  label?: string
}

/**
 * Loading indicator. Hidden from assistive tech unless `label` is provided,
 * so it never double-announces inside a button that already sets aria-busy.
 */
function Spinner({ className, size = 'md', label, ...props }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex items-center justify-center text-current', className)}
      {...props}
    >
      <Loader2 className={cn('animate-spin', spinnerSizes[size])} aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

export { Spinner }
