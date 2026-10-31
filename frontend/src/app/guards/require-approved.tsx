import type * as React from 'react'
import { Navigate } from 'react-router-dom'

import { useSession } from '@/features/auth/session-context'

/**
 * Blocks accounts that are not in good standing.
 * Pending registrations may only see the pending screen; suspended accounts
 * are sent to access-denied. Neither state ever reaches club data.
 */
export function RequireApproved({ children }: { children: React.ReactNode }) {
  const { user } = useSession()

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  if (user.status === 'pending') {
    return <Navigate to="/pending" replace />
  }

  if (user.status === 'suspended') {
    return <Navigate to="/unauthorized" replace state={{ reason: 'suspended' }} />
  }

  if (user.status === 'deactivated') {
    return <Navigate to="/unauthorized" replace state={{ reason: 'deactivated' }} />
  }

  return <>{children}</>
}
