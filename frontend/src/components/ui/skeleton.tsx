import * as React from 'react'

import { cn } from '@/lib/cn'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-sm bg-surface-2', className)}
      {...props}
    />
  )
}

export { Skeleton }
