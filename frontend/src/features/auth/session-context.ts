import * as React from 'react'

import type { SessionUser } from './types'

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  signOut: () => void
  /** Re-reads the profile and roles, e.g. after an admin approves the account. */
  refresh: () => Promise<void>
}

export const SessionContext = React.createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const session = React.useContext(SessionContext)

  if (!session) {
    throw new Error('useSession must be used inside <SessionProvider>')
  }

  return session
}
