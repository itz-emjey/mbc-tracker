import * as React from 'react'

import {
  SessionContext,
  type DevPersona,
  type SessionState,
  type SessionStatus,
} from './session-context'

/**
 * ⚠️ DEVELOPMENT ONLY — NOT AUTHENTICATION.
 *
 * This adapter exists so the shell, navigation, and guards can be exercised
 * before Supabase Auth is wired in Group E. It stores a persona id in
 * localStorage and trusts it completely. It must never be used to decide what
 * a real user can read or write; the database does not know or care about it.
 *
 * Group E replaces this with a real Supabase session.
 */

const STORAGE_KEY = 'mbc:dev-persona'

const PERSONAS: readonly DevPersona[] = [
  {
    id: 'super-admin',
    label: 'Super Admin',
    description: 'Full access to every module and administration.',
    user: {
      id: 'dev-super-admin',
      name: 'Alex Torres',
      email: 'alex@example.test',
      roles: ['super_admin'],
      status: 'approved',
    },
  },
  {
    id: 'manager-trainer',
    label: 'Multi-role',
    description: 'Tournament Manager + Trainer on one account.',
    user: {
      id: 'dev-multi-role',
      name: 'Jamie Cruz',
      email: 'jamie@example.test',
      roles: ['tournament_manager', 'trainer'],
      status: 'approved',
    },
  },
  {
    id: 'player',
    label: 'Player',
    description: 'Standard club member.',
    user: {
      id: 'dev-player',
      name: 'Mika Santos',
      email: 'mika@example.test',
      roles: ['player'],
      status: 'approved',
    },
  },
  {
    id: 'pending',
    label: 'Pending approval',
    description: 'Registered but not yet approved by an admin.',
    user: {
      id: 'dev-pending',
      name: 'Rico Bautista',
      email: 'rico@example.test',
      roles: ['player'],
      status: 'pending',
    },
  },
  {
    id: 'suspended',
    label: 'Suspended',
    description: 'Deactivated account that keeps its history.',
    user: {
      id: 'dev-suspended',
      name: 'Dana Lim',
      email: 'dana@example.test',
      roles: ['player'],
      status: 'suspended',
    },
  },
  {
    id: 'signed-out',
    label: 'Signed out',
    description: 'No session.',
    user: null,
  },
]

function readPersonaId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? 'super-admin'
  } catch {
    return 'super-admin'
  }
}

export function DevSessionProvider({ children }: { children: React.ReactNode }) {
  const [personaId, setPersonaId] = React.useState<string>(readPersonaId)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    // A session is never available in the first render of a real client: it has
    // to be restored. Mirrors that asynchronous boundary so the loading state
    // is exercised instead of skipped.
    const timer = window.setTimeout(() => setHydrated(true), 0)

    return () => window.clearTimeout(timer)
  }, [])

  const persona = PERSONAS.find((item) => item.id === personaId) ?? PERSONAS[PERSONAS.length - 1]!
  const user = persona.user ?? null

  const switchTo = React.useCallback((nextId: string) => {
    setPersonaId(nextId)

    try {
      window.localStorage.setItem(STORAGE_KEY, nextId)
    } catch {
      /* private mode — the in-memory persona still applies */
    }
  }, [])

  const signOut = React.useCallback(() => switchTo('signed-out'), [switchTo])

  const status: SessionStatus = !hydrated ? 'loading' : user ? 'authenticated' : 'unauthenticated'

  const value: SessionState = React.useMemo(
    () => ({
      status,
      user,
      signOut,
      dev: { personaId: persona.id, personas: PERSONAS, switchTo },
    }),
    [status, user, signOut, persona.id, switchTo],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
