import { CalendarCheck, Crosshair, Trophy, Zap } from 'lucide-react'
import type * as React from 'react'

import { Brand } from '@/app/components/brand'
import { useDocumentTitle } from '@/app/hooks/use-document-title'

export interface AuthLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

const ARENA_POINTS = [
  {
    icon: Trophy,
    title: 'Tournaments with real draws',
    description: 'Singles, doubles, and mixed brackets that keep an official record.',
  },
  {
    icon: Zap,
    title: 'ShuttlePower ranking',
    description: 'A strength-based club rating with an auditable ledger behind it.',
  },
  {
    icon: CalendarCheck,
    title: 'Training and dues',
    description: 'Attendance and fee records you can actually check yourself.',
  },
]

/**
 * Standalone layout for screens that must render without the application
 * shell: sign-in, registration, pending approval, and access denied.
 *
 * Desktop gets an arena panel beside the form; mobile keeps a single column so
 * the primary action is never pushed below the fold.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  useDocumentTitle(title)

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-1 p-10 lg:flex">
        <Brand />

        <div className="max-w-md">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
            <span aria-hidden="true" className="h-px w-6 bg-accent" />
            Matag-ob Badminton Club
          </p>

          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text">
            One club.
            <br />
            One arena.
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            Tournaments, challenges, ShuttlePower, training, and club news — held in one place and
            built to stay accurate.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {ARENA_POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-border bg-surface-2 text-accent">
                  <point.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">{point.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
                    {point.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-5 text-[11px] text-text-faint">
          <span className="grid size-8 place-items-center rounded-sm bg-accent-soft text-accent">
            <Crosshair className="size-4" aria-hidden="true" />
          </span>
          <span>Members-only. Accounts are approved by a club admin.</span>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4 sm:px-6 lg:hidden">
          <Brand />
        </header>

        <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 lg:items-center lg:py-10">
          <div className="w-full max-w-md">
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-accent lg:hidden">
              <span aria-hidden="true" className="h-px w-6 bg-accent" />
              MBC Arena
            </p>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text lg:mt-0">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{description}</p>
            <div className="mt-5">{children}</div>
          </div>
        </main>

        <footer className="px-4 pb-6 text-center text-[11px] text-text-faint">
          Matag-ob Badminton Club · Arena
        </footer>
      </div>
    </div>
  )
}
