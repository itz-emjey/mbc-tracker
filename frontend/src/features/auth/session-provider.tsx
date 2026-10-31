import type { User } from '@supabase/supabase-js'
import * as React from 'react'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase'

import { errorMessage, loadSessionUser, signOut as signOutApi } from './api'
import { SessionContext, type SessionState, type SessionStatus } from './session-context'
import type { SessionUser } from './types'

interface ClientState {
  client: ReturnType<typeof getSupabaseClient> | null
  error: string | null
}

function resolveClient(): ClientState {
  try {
    return { client: getSupabaseClient(), error: null }
  } catch (error) {
    return { client: null, error: errorMessage(error) }
  }
}

function ConfigurationScreen({ message }: { message: string }) {
  return (
    <AuthLayout
      title="Supabase configuration required"
      description="The app cannot start authentication until the public Supabase URL and publishable key are configured."
    >
      <ErrorState
        title="Missing or invalid environment"
        description="Copy frontend/.env.example to frontend/.env.local, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server."
      />
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-1 p-4 text-xs leading-relaxed text-text-muted">
        {message}
      </pre>
    </AuthLayout>
  )
}

interface LiveSessionProviderProps {
  client: NonNullable<ClientState['client']>
  children: React.ReactNode
}

function LiveSessionProvider({ client, children }: LiveSessionProviderProps) {
  const [authUser, setAuthUser] = React.useState<User | null | undefined>(undefined)
  const [user, setUser] = React.useState<SessionUser | null>(null)
  const [status, setStatus] = React.useState<SessionStatus>('loading')
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return

      if (error) {
        setAuthUser(null)
        setUser(null)
        setStatus('unauthenticated')
        setLoadError(errorMessage(error))
        return
      }

      const nextUser = data.session?.user ?? null
      setAuthUser(nextUser)

      if (nextUser) {
        setStatus('loading')
      } else {
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setAuthUser(nextUser)
      setLoadError(null)

      if (nextUser) {
        // Show the loading state before the async profile load so guards do not
        // briefly mistake a fresh sign-in for a signed-out visitor.
        setStatus('loading')
      } else {
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  React.useEffect(() => {
    if (authUser === undefined || authUser === null) return

    let active = true

    void loadSessionUser(authUser)
      .then((nextUser) => {
        if (!active) return

        setUser(nextUser)
        setStatus(nextUser ? 'authenticated' : 'unauthenticated')
      })
      .catch((error: unknown) => {
        if (!active) return

        setUser(null)
        setStatus('unauthenticated')
        setLoadError(errorMessage(error))
      })

    return () => {
      active = false
    }
  }, [authUser])

  const refresh = React.useCallback(async () => {
    if (!authUser) return

    setStatus('loading')
    setLoadError(null)

    try {
      const nextUser = await loadSessionUser(authUser)
      setUser(nextUser)
      setStatus(nextUser ? 'authenticated' : 'unauthenticated')
    } catch (error) {
      setUser(null)
      setStatus('unauthenticated')
      setLoadError(errorMessage(error))
    }
  }, [authUser])

  const signOut = React.useCallback(() => {
    void signOutApi().catch((error: unknown) => {
      setLoadError(errorMessage(error))
    })
  }, [])

  const value = React.useMemo<SessionState>(
    () => ({ status, user, signOut, refresh }),
    [status, user, signOut, refresh],
  )

  if (loadError && authUser) {
    return (
      <AuthLayout
        title="Could not load your account"
        description="Your sign-in worked, but the club profile could not be read. This is usually temporary."
      >
        <ErrorState
          title="Account unavailable"
          description={loadError}
          onRetry={() => void refresh()}
          retryLabel="Try again"
        />
        <Button variant="secondary" className="mt-4 w-full" onClick={signOut}>
          Sign out
        </Button>
      </AuthLayout>
    )
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/**
 * Real Supabase Auth session source.
 *
 * There is no development persona and no fallback identity: without a valid
 * Auth session the app stays signed out. The database remains the authority
 * for every read and write.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state] = React.useState<ClientState>(resolveClient)

  if (!state.client) {
    return <ConfigurationScreen message={state.error ?? 'Unknown configuration error'} />
  }

  return <LiveSessionProvider client={state.client}>{children}</LiveSessionProvider>
}
