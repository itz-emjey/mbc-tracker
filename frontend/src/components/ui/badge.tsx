import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill border font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-2 text-text-muted',
        accent: 'border-transparent bg-accent-soft text-accent',
        warning: 'border-transparent bg-warning-soft text-warning',
        danger: 'border-transparent bg-danger-soft text-danger',
        info: 'border-transparent bg-info-soft text-info',
        gold: 'border-transparent bg-gold-soft text-gold',
        silver: 'border-transparent bg-silver-soft text-silver',
        bronze: 'border-transparent bg-bronze-soft text-bronze',
        outline: 'border-border-strong bg-transparent text-text-muted',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
        md: 'px-2.5 py-1 text-[11px] uppercase tracking-[0.06em]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'sm',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
}

export { Badge, badgeVariants }
