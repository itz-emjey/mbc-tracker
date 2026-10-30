import type * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useSession } from '@/features/auth/session-context'
import { hasAnyRole, type Role } from '@/features/auth/types'

export interface RequireRoleProps {
  /** Allowed roles. Omit for "any approved member". */
  roles?: readonly Role[]
  children: React.ReactNode
}

/**
 * Role gate for a route or subtree. Accepts multiple roles: holding any one
 * of them is enough, which is what makes multi-role accounts work.
 *
 * This is UX, not security. Hiding or blocking a route does not protect the
 * underlying tables — RLS and RPC guards do that, and they are tested
 * separately in `backend/`.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user } = useSession()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  if (!hasAnyRole(user.roles, roles)) {
    return (
      <Navigate to="/unauthorized" replace state={{ from: location.pathname, required: roles }} />
    )
  }

  return <>{children}</>
}
