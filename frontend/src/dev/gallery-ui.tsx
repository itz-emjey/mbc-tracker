import type * as React from 'react'

import { cn } from '@/lib/cn'

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-8">
      <header className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-text">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">{description}</p>
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-faint">
          {label}
        </p>
        {hint ? <p className="text-[11px] text-text-faint">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** Forced visual state for documentation screenshots (hover/focus can't be captured otherwise). */
export function StateCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-text-faint">{label}</p>
      {children}
    </div>
  )
}

export function Panel({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-border bg-surface-1 p-5', className)}>
      {title ? (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {description ? <p className="mt-1 text-xs text-text-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
