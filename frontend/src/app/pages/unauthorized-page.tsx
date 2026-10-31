import { ShieldAlert } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS, type Role } from '@/features/auth/types'

interface UnauthorizedState {
  reason?: 'suspended' | 'deactivated'
  required?: Role[]
  from?: string
}

/** Access-denied state for signed-in accounts whose roles do not cover a route. */
export function UnauthorizedPage() {
  const { user, signOut } = useSession()
  const location = useLocation()
  const state = (location.state as UnauthorizedState | null) ?? {}
  const suspended = state.reason === 'suspended'
  const deactivated = state.reason === 'deactivated'
  const blocked = suspended || deactivated

  return (
    <AuthLayout
      title={
        suspended ? 'Account suspended' : deactivated ? 'Account deactivated' : 'Access denied'
      }
      description={
        blocked
          ? 'A Super Admin has closed access to this account. Records and history are retained, but the club workspace is unavailable.'
          : 'This page needs a role your account does not hold. Navigation hides it, and the route guard blocks direct links as well.'
      }
    >
      <div className="rounded-md border border-border bg-surface-1 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">
              {blocked ? 'Access is closed' : 'Not enough permissions'}
            </p>

            {user ? (
              <p className="mt-1 text-sm text-text-muted">
                Signed in as {user.name}
                {user.roles.length > 0
                  ? ` (${user.roles.map((role) => ROLE_LABELS[role]).join(', ')})`
                  : ''}
                .
              </p>
            ) : (
              <p className="mt-1 text-sm text-text-muted">No account is signed in.</p>
            )}

            {state.required?.length ? (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
                  One of these roles
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {state.required.map((role) => (
                    <Badge key={role} tone="outline">
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-xs leading-relaxed text-text-faint">
              Route guards are a navigation aid. They are not a security boundary — the database
              enforces access with row-level security regardless of what the interface shows.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {user ? (
            <>
              <Button asChild variant="secondary" size="sm" className="flex-1">
                <Link to="/">Back to overview</Link>
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild variant="secondary" size="sm" className="flex-1">
              <Link to="/sign-in">Go to sign-in</Link>
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
