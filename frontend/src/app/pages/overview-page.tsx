import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { modulesFor, APP_MODULES } from '@/app/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { PlayerIdentity } from '@/components/shared/player-identity'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS } from '@/features/auth/types'

const SHELL_CAPABILITIES = [
  'Application shell with desktop sidebar and mobile bar',
  'Role-aware navigation for multi-role accounts',
  'Reusable route guards for auth, approval, and role',
  'Loading, unauthenticated, access-denied, and not-found states',
] as const

/**
 * Overview is intentionally data-free until the player and tournament modules
 * exist. It shows the real session and the real module list — no invented
 * standings, players, or matches.
 */
export function OverviewPage() {
  const { user } = useSession()

  if (!user) {
    return null
  }

  const modules = modulesFor(user.roles)

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Signed in as ${user.name}. Your navigation shows the combined access of every role you hold.`}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your access</CardTitle>
            <CardDescription>
              Frontend role checks shape navigation only. The database decides what data is readable
              or writable.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <PlayerIdentity
              name={user.name}
              meta={user.email}
              size="lg"
              trailing={
                <Badge tone={user.status === 'approved' ? 'accent' : 'warning'}>
                  {user.status === 'approved' ? 'Approved' : 'Pending'}
                </Badge>
              }
            />

            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-text-faint">Roles</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {user.roles.map((role) => (
                  <Badge key={role} tone="accent" size="md">
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phase 1 foundation</CardTitle>
            <CardDescription>
              Groups A–D deliver the platform shell. Club business modules follow in later groups.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ul className="flex flex-col gap-2">
              {SHELL_CAPABILITIES.map((capability) => (
                <li key={capability} className="flex items-start gap-2 text-sm text-text-muted">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                  />
                  {capability}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="overview-modules" className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="overview-modules" className="text-base font-semibold text-text">
              Modules available to you
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {modules.length} of {APP_MODULES.length} modules. Items marked with a phase are routed
              and guarded but not built yet.
            </p>
          </div>
        </div>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon

            return (
              <li key={module.path} className="min-w-0">
                <Link
                  to={module.path}
                  className="group flex items-center gap-3 rounded-md border border-border bg-surface-1 px-4 py-3 transition-colors duration-fast hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-text-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {module.label}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {module.description}
                    </span>
                  </span>

                  {module.phase ? (
                    <Badge tone="outline">{module.phase}</Badge>
                  ) : (
                    <Badge tone="accent">Live</Badge>
                  )}

                  <ArrowRight
                    className="size-4 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
