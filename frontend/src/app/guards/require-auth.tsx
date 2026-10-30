import type * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useSession } from '@/features/auth/session-context'
import { AppLoading } from '@/app/states/app-loading'

/**
 * Requires a session. Redirects to sign-in and remembers where the user was
 * heading so a real login (Group E) can return them there.
 *
 * Navigation guard only — authorization of data happens in the database.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession()
  const location = useLocation()

  if (status === 'loading') {
    return <AppLoading />
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
