import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Arena surfaces.
 *
 * Cards are HUD panels: a flat surface with a ruled header and compact,
 * evenly-weighted padding. Everything built from these primitives — including
 * feature panels written before the arena redesign — inherits the same look,
 * so no module drifts back to the old card style.
 */

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('overflow-hidden rounded-md border border-border bg-surface-1', className)}
      {...props}
    />
  )
})

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-1 border-b border-border px-4 py-3',
          '[&:last-child]:border-b-0',
          className,
        )}
        {...props}
      />
    )
  },
)

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('text-sm font-semibold leading-tight text-text', className)}
        {...props}
      />
    )
  },
)

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p ref={ref} className={cn('text-xs leading-relaxed text-text-muted', className)} {...props} />
  )
})

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-4 py-3', className)} {...props} />
  },
)

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2 border-t border-border px-4 py-2.5', className)}
        {...props}
      />
    )
  },
)

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
