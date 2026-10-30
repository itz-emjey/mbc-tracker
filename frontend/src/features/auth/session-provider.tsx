import * as React from 'react'

import { DevSessionProvider } from './dev-session'
import { SessionContext, type SessionState } from './session-context'

const UNAUTHENTICATED: SessionState = {
  status: 'unauthenticated',
  user: null,
  signOut: () => {},
  dev: null,
}

function UnavailableSessionProvider({ children }: { children: React.ReactNode }) {
  // No authentication is configured yet (Group E). The app renders as
  // signed-out; there is no fallback persona and no bypass.
  return <SessionContext.Provider value={UNAUTHENTICATED}>{children}</SessionContext.Provider>
}

/**
 * Picks the session source.
 *
 * - Development: a local persona switcher, clearly labelled as not being
 *   authentication.
 * - Production: no session at all until Supabase Auth is wired in Group E.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  if (import.meta.env.DEV) {
    return <DevSessionProvider>{children}</DevSessionProvider>
  }

  return <UnavailableSessionProvider>{children}</UnavailableSessionProvider>
}
