import * as React from 'react'

import type { SessionUser } from './types'

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface DevPersona {
  id: string
  label: string
  description: string
  user: SessionUser | null
}

/**
 * Development-only session controls.
 * Always `null` in a production build — there is no way to obtain a session
 * without configured authentication.
 */
export interface DevSessionApi {
  personaId: string
  personas: readonly DevPersona[]
  switchTo: (personaId: string) => void
}

export interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  signOut: () => void
  dev: DevSessionApi | null
}

export const SessionContext = React.createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const session = React.useContext(SessionContext)

  if (!session) {
    throw new Error('useSession must be used inside <SessionProvider>')
  }

  return session
}
